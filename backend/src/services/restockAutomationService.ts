import { RestockOrderStatus, RestockRecommendationSource } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { listRestockPlanningCandidates } from "./restockPlanningService.js";
import { approveRestockOrder, createRestockOrder } from "./restockService.js";

const AUTOMATION_PAGE_SIZE = 100;
const DEFAULT_RECONCILE_INTERVAL_MS = 30_000;
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
const EXTENDABLE_BATCH_STATUSES = new Set<RestockOrderStatus>([
  RestockOrderStatus.DRAFT,
  RestockOrderStatus.APPROVED,
  RestockOrderStatus.AWAITING_DELIVERY
]);
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
        candidate.recommendationSource !== RestockRecommendationSource.LOW_STOCK &&
        candidate.recommendationSource !== RestockRecommendationSource.TARGET_STOCK
      ) {
        continue;
      }

      lines.push({
        productId: candidate.product.id,
        quantity,
        recommendationId: candidate.recommendationId,
        recommendationSource: candidate.recommendationSource
      });
    }

    if (page >= result.meta.totalPages) return lines;
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

async function appendActionLinesToMonthlyBatch(
  batchOrder: RestockTicketIdentity,
  actionLines: RestockActionLine[]
) {
  if (!EXTENDABLE_BATCH_STATUSES.has(batchOrder.status) || actionLines.length === 0) {
    return batchOrder;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.restockOrder.findUnique({
      select: {
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
        status: true,
        version: true
      },
      where: { id: batchOrder.id }
    });

    if (!current || !EXTENDABLE_BATCH_STATUSES.has(current.status)) return null;
    if (current.lines.some((line) => line.receivedQuantity > 0)) return null;

    const existingByProduct = new Map(current.lines.map((line) => [line.productId, line]));
    const recommendationIds: string[] = [];

    for (const line of actionLines) {
      const existing = existingByProduct.get(line.productId);
      if (line.recommendationId) recommendationIds.push(line.recommendationId);

      if (existing) {
        await tx.restockOrderLine.update({
          data: {
            recommendationId: line.recommendationId ?? existing.recommendationId,
            recommendedQuantity: { increment: line.quantity },
            requestedQuantity: { increment: line.quantity }
          },
          where: { id: existing.id }
        });
        continue;
      }

      await tx.restockOrderLine.create({
        data: {
          isSelected: true,
          notes: "Operational restock forecast added this line to the monthly batch.",
          ownerOverrideReason: null,
          productId: line.productId,
          receivedQuantity: 0,
          recommendationId: line.recommendationId,
          recommendationSource: line.recommendationSource,
          recommendedQuantity: line.quantity,
          requestedQuantity: line.quantity,
          restockOrderId: current.id
        }
      });
    }

    if (recommendationIds.length > 0 && current.status !== RestockOrderStatus.DRAFT) {
      await tx.recommendationRecord.updateMany({
        data: { status: "ACKNOWLEDGED" },
        where: {
          id: { in: recommendationIds },
          status: "OPEN"
        }
      });
    }

    const order = await tx.restockOrder.update({
      data: { version: { increment: 1 } },
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
      where: { id: current.id }
    });

    return order;
  });

  return updated ?? batchOrder;
}

async function runRestockAutomation(): Promise<RestockAutomationResult> {
  const batch = monthlyBatchIdentity();
  const actionLines = await loadOperationalActionLines();

  if (actionLines.length === 0) {
    return { orderId: null, orderNumber: null, status: "NO_ACTION" };
  }

  const monthOrders = await loadAutomatedTicketsForMonth(batch);
  const monthlyOrder = findMonthlyBatch(monthOrders, batch);

  if (monthlyOrder) {
    if (monthlyOrder.status === RestockOrderStatus.CANCELLED) {
      console.info(
        `[restock] ${batch.monthKey} automation remains suppressed by cancelled batch ${monthlyOrder.orderNumber}.`
      );
      return {
        orderId: monthlyOrder.id,
        orderNumber: monthlyOrder.orderNumber,
        status: "CANCELLED"
      };
    }

    if (
      monthlyOrder.status === RestockOrderStatus.PARTIALLY_RECEIVED ||
      monthlyOrder.status === RestockOrderStatus.RECEIVED
    ) {
      console.info(
        `[restock] ${batch.monthKey} monthly batch ${monthlyOrder.orderNumber} has already started receiving; no second automated ticket will be created this month.`
      );
      return {
        orderId: monthlyOrder.id,
        orderNumber: monthlyOrder.orderNumber,
        status: "EXISTING"
      };
    }

    const actorId =
      monthlyOrder.status === RestockOrderStatus.DRAFT ? await findAutomationActorId() : null;
    if (monthlyOrder.status === RestockOrderStatus.DRAFT && !actorId) {
      console.warn("[restock] No active user is available to approve the monthly restock batch.");
      return { orderId: monthlyOrder.id, orderNumber: monthlyOrder.orderNumber, status: "NO_ACTOR" };
    }

    const merged = await appendActionLinesToMonthlyBatch(monthlyOrder, actionLines);
    if (merged.status === RestockOrderStatus.DRAFT && actorId) {
      const approved = await approveRestockOrder(
        merged.id,
        { expectedVersion: merged.version },
        actorId
      );
      console.info(
        `[restock] Updated and auto-approved monthly batch ${approved.orderNumber} for ${batch.monthKey}.`
      );
      return { orderId: approved.id, orderNumber: approved.orderNumber, status: "UPDATED" };
    }

    console.info(
      `[restock] Added ${actionLines.length} replenishment line(s) to monthly batch ${merged.orderNumber}.`
    );
    return { orderId: merged.id, orderNumber: merged.orderNumber, status: "UPDATED" };
  }

  const legacyOrders = monthOrders.filter(isLegacyAutomatedTicket);
  if (legacyOrders.length > 0) {
    const latestLegacy = legacyOrders.at(-1)!;
    console.info(
      `[restock] ${batch.monthKey} already contains ${legacyOrders.length} legacy automated ticket(s). Monthly batching will not create another ticket in this month.`
    );
    return {
      orderId: latestLegacy.id,
      orderNumber: latestLegacy.orderNumber,
      status:
        latestLegacy.status === RestockOrderStatus.CANCELLED ? "CANCELLED" : "EXISTING"
    };
  }

  const actorId = await findAutomationActorId();
  if (!actorId) {
    console.warn("[restock] No active user is available to own the automated monthly restock batch.");
    return { orderId: null, orderNumber: null, status: "NO_ACTOR" };
  }

  const totalUnits = actionLines.reduce((sum, line) => sum + line.quantity, 0);
  const order = await createRestockOrder(
    {
      notes: `${batch.marker} Automatically generated monthly batch from the operational restock forecast.`,
      lines: actionLines.map((line) => ({
        isSelected: true,
        notes: "Operational restock forecast generated this replenishment line.",
        ownerOverrideReason: null,
        productId: line.productId,
        recommendationId: line.recommendationId,
        recommendationSource: line.recommendationSource,
        recommendedQuantity: line.quantity,
        requestedQuantity: line.quantity
      }))
    },
    actorId
  );

  const renamed = await prisma.restockOrder.update({
    data: { orderNumber: batch.orderNumber },
    select: { id: true, orderNumber: true, version: true },
    where: { id: order.id }
  });
  const approved = await approveRestockOrder(
    renamed.id,
    { expectedVersion: renamed.version },
    actorId
  );

  console.info(
    `[restock] Created monthly batch ${approved.orderNumber} with ${actionLines.length} product(s), ${totalUnits} unit(s), and auto-approved it for Receiving.`
  );

  return {
    orderId: approved.id,
    orderNumber: approved.orderNumber,
    status: "CREATED"
  };
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
