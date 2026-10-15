import { randomUUID } from "node:crypto";

import { Prisma, RestockOrderStatus, RestockRecommendationSource } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { listRestockPlanningCandidates } from "./restockPlanningService.js";
import { assessProcurementSafety, exceedsRestockOrderBudget } from "./restockProcurementSafety.js";
import { createRestockOrder } from "./restockService.js";
import { monthlyRestockCycle } from "./restockMonthlyCyclePolicy.js";

const AUTOMATION_PAGE_SIZE = 100;
const DEFAULT_RECONCILE_INTERVAL_MS = 60 * 60_000;
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const MONTH_ABBREVIATIONS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC"
] as const;
let inFlightAutomation: Promise<RestockAutomationResult> | null = null;
let workerTimer: NodeJS.Timeout | null = null;
let workerReconciliation: Promise<void> | null = null;

type RestockAutomationStatus =
  | "CREATED"
  | "UPDATED"
  | "EXISTING"
  | "NO_ACTION"
  | "NO_ACTOR"
  | "CANCELLED";

type RestockAutomationResult = {
  orderId: string | null;
  orderNumber: string | null;
  status: RestockAutomationStatus;
};

type RestockActionLine = {
  productId: string;
  quantity: number;
  recommendationId: string | null;
  recommendationSource:
    | typeof RestockRecommendationSource.SARIMA
    | typeof RestockRecommendationSource.LOW_STOCK
    | typeof RestockRecommendationSource.TARGET_STOCK;
};

type MonthlyBatchIdentity = {
  marker: string;
  monthKey: string;
  monthStart: Date;
  nextMonthStart: Date;
  orderNumber: string;
};

type RestockTicketIdentity = {
  createdAt: Date;
  id: string;
  lines: Array<{
    id: string;
    productId: string;
    receivedQuantity: number;
    recommendationId: string | null;
    recommendationSource: RestockRecommendationSource;
    recommendedQuantity: number;
    requestedQuantity: number;
  }>;
  notes: string | null;
  orderNumber: string;
  status: RestockOrderStatus;
  version: number;
};

function monthlyBatchIdentity(date = new Date()): MonthlyBatchIdentity {
  const manilaDate = new Date(date.getTime() + MANILA_OFFSET_MS);
  const year = manilaDate.getUTCFullYear();
  const monthIndex = manilaDate.getUTCMonth();
  const month = String(monthIndex + 1).padStart(2, "0");
  const monthKey = `${year}-${month}`;
  const monthStart = new Date(Date.UTC(year, monthIndex, 1) - MANILA_OFFSET_MS);
  const nextMonthStart = new Date(Date.UTC(year, monthIndex + 1, 1) - MANILA_OFFSET_MS);

  return {
    marker: `[AutomatedRestockMonth:${monthKey}]`,
    monthKey,
    monthStart,
    nextMonthStart,
    orderNumber: `RO-${MONTH_ABBREVIATIONS[monthIndex]}-${year}`
  };
}

function isLegacyAutomatedTicket(order: RestockTicketIdentity) {
  return order.notes?.includes("[AutomatedRestock:") ?? false;
}

function isMonthlyAutomatedTicket(order: RestockTicketIdentity, batch: MonthlyBatchIdentity) {
  return order.orderNumber === batch.orderNumber || order.notes?.includes(batch.marker) === true;
}

async function findAutomationActorId() {
  const owner = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
    where: { role: "OWNER", status: "ACTIVE" }
  });
  if (owner) return owner.id;

  const fallback = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
    where: { status: "ACTIVE" }
  });
  return fallback?.id ?? null;
}

async function loadOperationalActionLines() {
  const lines: RestockActionLine[] = [];
  let page = 1;
  const lineCosts: number[] = [];

  while (true) {
    const result = await listRestockPlanningCandidates({
      includeZero: false,
      page,
      pageSize: AUTOMATION_PAGE_SIZE
    });

    for (const candidate of result.items) {
      const quantity = Math.max(0, Math.ceil(candidate.recommendedQuantity));
      if (quantity <= 0) continue;
      if (
        candidate.recommendationSource !== RestockRecommendationSource.SARIMA &&
        candidate.recommendationSource !== RestockRecommendationSource.LOW_STOCK &&
        candidate.recommendationSource !== RestockRecommendationSource.TARGET_STOCK
      ) {
        continue;
      }

      const verdict = assessProcurementSafety({
        requestedQuantity: quantity,
        monthlyPosDemand: candidate.stockHealth.monthlyDemand,
        posConfidence: candidate.stockHealth.confidence,
        sellableStock: candidate.sellableStock,
        incomingStock: candidate.incomingStock,
        expiryRiskQuantity: candidate.expiryRiskQuantity,
        unitCost: candidate.product.unitCost,
        recommendationSource: candidate.recommendationSource,
        targetStockLevel: candidate.product.targetStockLevel,
        approvedTargetStockLevel: candidate.product.approvedTargetStockLevel,
        targetApprovalById: candidate.product.targetApprovalById,
        targetApprovedAt: candidate.product.targetApprovedAt
      });
      if (!verdict.safe) {
        console.warn(
          `[restock] Holding automated recommendation for ${candidate.product.sku}: ${verdict.reason}. Owner review required.`
        );
        continue;
      }
      lineCosts.push(verdict.lineCostPHP);
      lines.push({
        productId: candidate.product.id,
        quantity,
        recommendationId: candidate.recommendationId,
        recommendationSource: candidate.recommendationSource
      });
    }

    if (page >= result.meta.totalPages) {
      if (exceedsRestockOrderBudget(lineCosts)) {
        console.warn(
          "[restock] Monthly automated recommendations exceed the purchase budget. No draft was created or updated."
        );
        return [];
      }
      return lines;
    }
    page += 1;
  }
}

async function loadAutomatedTicketsForMonth(
  batch: MonthlyBatchIdentity
): Promise<RestockTicketIdentity[]> {
  const orders = await prisma.restockOrder.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      createdAt: true,
      id: true,
      lines: {
        select: {
          id: true,
          productId: true,
          receivedQuantity: true,
          recommendationId: true,
          recommendationSource: true,
          recommendedQuantity: true,
          requestedQuantity: true
        }
      },
      notes: true,
      orderNumber: true,
      status: true,
      version: true
    },
    where: {
      createdAt: {
        gte: batch.monthStart,
        lt: batch.nextMonthStart
      }
    }
  });

  return orders.filter(
    (order) => isMonthlyAutomatedTicket(order, batch) || isLegacyAutomatedTicket(order)
  );
}

function findMonthlyBatch(orders: RestockTicketIdentity[], batch: MonthlyBatchIdentity) {
  return orders.find((order) => isMonthlyAutomatedTicket(order, batch)) ?? null;
}

/** Durable monthly gate, using existing deterministic audit primary keys.
 * Completed no-action runs stay closed. A compare-and-swap lease allows crash recovery.
 */
const MONTHLY_LEASE_MS = 15 * 60_000;
type MonthlyClaim = { id: string; lease: string };

async function claimMonthlyRun(monthKey: string): Promise<MonthlyClaim | null> {
  const id = "restock-monthly-run-" + monthKey;
  const lease = randomUUID();
  const stamp = new Date().toISOString();
  const previous = await prisma.catalogAuditLog.findUnique({
    select: { action: true, actor: true, reason: true },
    where: { id }
  });
  if (!previous) {
    try {
      await prisma.catalogAuditLog.create({
        data: {
          action: "RESTOCK_MONTH_RUNNING",
          actor: lease,
          automated: true,
          entityId: monthKey,
          entityType: "RESTOCK_MONTH",
          evidence: { activationMonth: monthKey },
          id,
          reason: stamp
        }
      });
      return { id, lease };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return null;
      }
      throw error;
    }
  }
  if (previous.action === "RESTOCK_MONTH_CREATED" || previous.action === "RESTOCK_MONTH_NO_ACTION") {
    return null;
  }
  const started = Date.parse(previous.reason);
  if (
    previous.action === "RESTOCK_MONTH_RUNNING" &&
    Number.isFinite(started) &&
    Date.now() - started < MONTHLY_LEASE_MS
  ) {
    return null;
  }
  const result = await prisma.catalogAuditLog.updateMany({
    data: { action: "RESTOCK_MONTH_RUNNING", actor: lease, reason: stamp },
    where: { id, action: previous.action, actor: previous.actor, reason: previous.reason }
  });
  return result.count === 1 ? { id, lease } : null;
}

async function completeMonthlyRun(
  claim: MonthlyClaim,
  action: "RESTOCK_MONTH_CREATED" | "RESTOCK_MONTH_NO_ACTION" | "RESTOCK_MONTH_RETRY",
  reason: string
) {
  await prisma.catalogAuditLog.updateMany({
    data: { action, reason },
    where: { id: claim.id, actor: claim.lease, action: "RESTOCK_MONTH_RUNNING" }
  });
}

async function runRestockAutomation(): Promise<RestockAutomationResult> {
  const batch = monthlyBatchIdentity();
  // Snapshot-first: an existing month is immutable, even after worker restarts.
  // Do not rerun the forecast or mutate the Owner's saved draft on refresh.
  const monthOrders = await loadAutomatedTicketsForMonth(batch);
  const monthlyOrder = findMonthlyBatch(monthOrders, batch);

  if (monthlyOrder) {
    return {
      orderId: monthlyOrder.id,
      orderNumber: monthlyOrder.orderNumber,
      status: monthlyOrder.status === RestockOrderStatus.CANCELLED ? "CANCELLED" : "EXISTING"
    };
  }

  const legacyOrders = monthOrders.filter(isLegacyAutomatedTicket);
  if (legacyOrders.length > 0) {
    const latestLegacy = legacyOrders.at(-1)!;
    return {
      orderId: latestLegacy.id,
      orderNumber: latestLegacy.orderNumber,
      status: latestLegacy.status === RestockOrderStatus.CANCELLED ? "CANCELLED" : "EXISTING"
    };
  }

  // Release cutover: preserve existing October orders but never create a new October batch midmonth.
  if (!monthlyRestockCycle().automationEnabled) {
    return { orderId: null, orderNumber: null, status: "NO_ACTION" };
  }
  const claim = await claimMonthlyRun(batch.monthKey);
  if (!claim) return { orderId: null, orderNumber: null, status: "NO_ACTION" };

  try {
  // Evaluate once per activated month, with persistent no-action/created state.
  const actionLines = await loadOperationalActionLines();
  if (actionLines.length === 0) {
    await completeMonthlyRun(claim, "RESTOCK_MONTH_NO_ACTION", "No eligible monthly restock.");
    return { orderId: null, orderNumber: null, status: "NO_ACTION" };
  }

  const actorId = await findAutomationActorId();
  if (!actorId) {
    console.warn(
      "[restock] No active user is available to own the automated monthly restock batch."
    );
    await completeMonthlyRun(claim, "RESTOCK_MONTH_RETRY", "No active Owner/actor; retry later.");
    return { orderId: null, orderNumber: null, status: "NO_ACTOR" };
  }

  const totalUnits = actionLines.reduce((sum, line) => sum + line.quantity, 0);
  const previousMonth = new Date(batch.monthStart.getTime() - 86_400_000);
  const sourceMonth = new Date(previousMonth.getTime() + MANILA_OFFSET_MS)
    .toISOString()
    .slice(0, 7);
  let order: Awaited<ReturnType<typeof createRestockOrder>>;
  try {
    // Unique orderNumber is claimed in the create transaction, not by a later rename.
    order = await createRestockOrder(
      {
        notes: `${batch.marker} [RestockSourceMonth:${sourceMonth}] Frozen forecast-driven multi-product batch; Owner approval required.`,
        lines: actionLines.map((line) => ({
          isSelected: true,
          notes: "Inventory Recommender generated this forecast-driven replenishment line.",
          ownerOverrideReason: null,
          productId: line.productId,
          recommendationId: line.recommendationId,
          recommendationSource: line.recommendationSource,
          recommendedQuantity: line.quantity,
          requestedQuantity: line.quantity
        }))
      },
      actorId,
      batch.orderNumber
    );
  } catch (error) {
    // Multi-process race: one server already created the uniquely named batch.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const competing = await prisma.restockOrder.findUnique({
        select: { id: true, orderNumber: true, status: true },
        where: { orderNumber: batch.orderNumber }
      });
      if (competing) {
        await completeMonthlyRun(claim, "RESTOCK_MONTH_CREATED", "Concurrent monthly draft preserved.");
        return {
          orderId: competing.id,
          orderNumber: competing.orderNumber,
          status: competing.status === RestockOrderStatus.CANCELLED ? "CANCELLED" : "EXISTING"
        };
      }
    }
    throw error;
  }

  await completeMonthlyRun(claim, "RESTOCK_MONTH_CREATED", "One Owner-review monthly draft created.");
  console.info(
    `[restock] Created owner-review monthly plan ${order.orderNumber} with ${actionLines.length} product(s) and ${totalUnits} recommended unit(s). Approval is required before Receiving.`
  );

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: "CREATED"
  };
  } catch (error) {
    await completeMonthlyRun(claim, "RESTOCK_MONTH_RETRY", "Monthly run interrupted; retry allowed.");
    throw error;
  }
}

export async function ensureAutomatedRestockTicket() {
  if (inFlightAutomation) return await inFlightAutomation;

  const automation = runRestockAutomation();
  inFlightAutomation = automation;

  try {
    return await automation;
  } finally {
    if (inFlightAutomation === automation) {
      inFlightAutomation = null;
    }
  }
}

async function reconcileAutomatedRestockTicket() {
  if (workerReconciliation) return await workerReconciliation;

  workerReconciliation = (async () => {
    try {
      const result = await ensureAutomatedRestockTicket();
      if ((result.status === "CREATED" || result.status === "UPDATED") && result.orderNumber) {
        console.info(`[restock] Monthly restock batch ready: ${result.orderNumber}.`);
      }
    } catch (error) {
      console.error("[restock] Automated restock ticket reconciliation failed.", error);
    }
  })();

  try {
    await workerReconciliation;
  } finally {
    workerReconciliation = null;
  }
}

export function startRestockAutomationWorker(intervalMs = DEFAULT_RECONCILE_INTERVAL_MS) {
  if (workerTimer) return;

  const safeIntervalMs = Math.max(5_000, Math.trunc(intervalMs));
  void reconcileAutomatedRestockTicket();

  workerTimer = setInterval(() => {
    void reconcileAutomatedRestockTicket();
  }, safeIntervalMs);
  workerTimer.unref();

  console.info(`[restock] Operational restock automation started (interval=${safeIntervalMs}ms).`);
}

export function stopRestockAutomationWorker() {
  if (!workerTimer) return;
  clearInterval(workerTimer);
  workerTimer = null;
}
