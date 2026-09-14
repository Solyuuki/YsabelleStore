import { RestockOrderStatus } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { listRestockPlanningCandidates } from "./restockPlanningService.js";
import { approveRestockOrder, createRestockOrder } from "./restockService.js";

const AUTOMATION_PAGE_SIZE = 100;
const DEFAULT_RECONCILE_INTERVAL_MS = 30_000;
const LIVE_TICKET_STATUSES = new Set<RestockOrderStatus>([
  RestockOrderStatus.DRAFT,
  RestockOrderStatus.APPROVED,
  RestockOrderStatus.AWAITING_DELIVERY,
  RestockOrderStatus.PARTIALLY_RECEIVED
]);
const inFlightByBatch = new Map<string, Promise<ForecastRestockAutomationResult>>();
let workerTimer: NodeJS.Timeout | null = null;
let workerReconciliation: Promise<void> | null = null;

type ForecastRestockAutomationStatus =
  | "CREATED"
  | "EXISTING"
  | "NO_ACTION"
  | "NO_ACTOR"
  | "CANCELLED";

type ForecastRestockAutomationResult = {
  batchId: string | null;
  orderId: string | null;
  orderNumber: string | null;
  status: ForecastRestockAutomationStatus;
};

type ForecastRestockActionLine = {
  productId: string;
  quantity: number;
  recommendationId: string | null;
  recommendationSource: "SARIMA";
};

type ForecastTicketIdentity = {
  id: string;
  orderNumber: string;
  status: RestockOrderStatus;
  version: number;
};

function batchMarker(batchId: string) {
  return `[ForecastBatch:${batchId}]`;
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

async function loadForecastActionLines(batchId: string) {
  const lines: ForecastRestockActionLine[] = [];
  let page = 1;

  while (true) {
    const result = await listRestockPlanningCandidates({
      includeZero: false,
      page,
      pageSize: AUTOMATION_PAGE_SIZE
    });

    for (const candidate of result.items) {
      const recommendedQuantity = Math.max(0, candidate.recommendedQuantity);
      if (candidate.forecast?.batchId !== batchId || recommendedQuantity <= 0) continue;

      lines.push({
        productId: candidate.product.id,
        quantity: recommendedQuantity,
        recommendationId:
          candidate.recommendationSource === "SARIMA" ? candidate.recommendationId : null,
        recommendationSource: "SARIMA"
      });
    }

    if (page >= result.meta.totalPages) return lines;
    page += 1;
  }
}

async function loadExistingForecastTickets(batchId: string): Promise<ForecastTicketIdentity[]> {
  return await prisma.restockOrder.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      orderNumber: true,
      status: true,
      version: true
    },
    where: { notes: { contains: batchMarker(batchId) } }
  });
}

function liveForecastTicket(orders: ForecastTicketIdentity[]) {
  return orders.find((order) => LIVE_TICKET_STATUSES.has(order.status)) ?? null;
}

function cancelledForecastTicket(orders: ForecastTicketIdentity[]) {
  return orders.find((order) => order.status === RestockOrderStatus.CANCELLED) ?? null;
}

async function runForecastRestockAutomation(
  batchId: string
): Promise<ForecastRestockAutomationResult> {
  const existingOrders = await loadExistingForecastTickets(batchId);
  const live = liveForecastTicket(existingOrders);

  if (live && live.status !== RestockOrderStatus.DRAFT) {
    console.info(
      `[restock] Forecast batch ${batchId} already has active ticket ${live.orderNumber} (${live.status}).`
    );
    return {
      batchId,
      orderId: live.id,
      orderNumber: live.orderNumber,
      status: "EXISTING"
    };
  }

  const actionLines = await loadForecastActionLines(batchId);
  const totalUnits = actionLines.reduce((sum, line) => sum + line.quantity, 0);

  if (actionLines.length === 0) {
    console.info(`[restock] Forecast batch ${batchId} has no actionable forecast lines.`);
    return { batchId, orderId: null, orderNumber: null, status: "NO_ACTION" };
  }

  console.info(
    `[restock] Forecast batch ${batchId} has ${actionLines.length} actionable product(s), ${totalUnits} unit(s) total.`
  );

  const actorId = await findAutomationActorId();
  if (!actorId) {
    console.warn(
      `[restock] Forecast batch ${batchId} has no active user to own its automated ticket.`
    );
    return { batchId, orderId: null, orderNumber: null, status: "NO_ACTOR" };
  }

  if (live?.status === RestockOrderStatus.DRAFT) {
    const approved = await approveRestockOrder(
      live.id,
      { expectedVersion: live.version },
      actorId
    );
    console.info(
      `[restock] Forecast batch ${batchId} recovered draft ${approved.orderNumber} and auto-approved it for Receiving.`
    );
    return {
      batchId,
      orderId: approved.id,
      orderNumber: approved.orderNumber,
      status: "CREATED"
    };
  }

  // Cancellation is an explicit owner decision. Do not recreate the same forecast batch every
  // reconciliation interval after an owner cancels its automated ticket. A newly generated
  // forecast batch gets a new batch id and can create a new automated ticket normally.
  const cancelled = cancelledForecastTicket(existingOrders);
  if (cancelled) {
    console.info(
      `[restock] Forecast batch ${batchId} remains suppressed by cancelled ticket ${cancelled.orderNumber}.`
    );
    return {
      batchId,
      orderId: cancelled.id,
      orderNumber: cancelled.orderNumber,
      status: "CANCELLED"
    };
  }

  // RECEIVED tickets are intentionally not treated as live blockers. Planning is recalculated
  // from current stock truth; if the same active demand batch still has a genuine replenishment
  // gap after receipt, another ticket may be created. Once created, its incoming quantity makes
  // it the live blocker and prevents duplicate retries.
  const marker = batchMarker(batchId);
  const order = await createRestockOrder(
    {
      notes: `${marker} Automatically generated from the active demand forecast.`,
      lines: actionLines.map((line) => ({
        isSelected: true,
        notes: `Forecast-generated restock from batch ${batchId}.`,
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

  const approved = await approveRestockOrder(order.id, { expectedVersion: order.version }, actorId);
  console.info(
    `[restock] Forecast batch ${batchId} generated and auto-approved ${approved.orderNumber} with ${actionLines.length} product(s), ${totalUnits} unit(s).`
  );

  return {
    batchId,
    orderId: approved.id,
    orderNumber: approved.orderNumber,
    status: "CREATED"
  };
}

export async function ensureForecastRestockTicket(batchId: string) {
  const current = inFlightByBatch.get(batchId);
  if (current) return await current;

  const automation = runForecastRestockAutomation(batchId);
  inFlightByBatch.set(batchId, automation);

  try {
    return await automation;
  } finally {
    if (inFlightByBatch.get(batchId) === automation) {
      inFlightByBatch.delete(batchId);
    }
  }
}

export async function ensureActiveForecastRestockTicket() {
  const active = await prisma.forecastBatchCache.findFirst({
    orderBy: { generatedAt: "desc" },
    select: { id: true },
    where: { isActive: true, status: "READY" }
  });

  if (!active) {
    console.info("[restock] No active READY forecast batch is available for automation.");
    return {
      batchId: null,
      orderId: null,
      orderNumber: null,
      status: "NO_ACTION"
    } as const;
  }

  return await ensureForecastRestockTicket(active.id);
}

async function reconcileStandaloneForecastTicket() {
  if (workerReconciliation) return await workerReconciliation;

  workerReconciliation = (async () => {
    try {
      const result = await ensureActiveForecastRestockTicket();
      if (result.status === "CREATED" && result.orderNumber) {
        console.info(
          `[restock] Standalone forecast automation created ${result.orderNumber} for Receiving.`
        );
      }
    } catch (error) {
      console.error("[restock] Standalone forecast ticket reconciliation failed.", error);
    }
  })();

  try {
    await workerReconciliation;
  } finally {
    workerReconciliation = null;
  }
}

export function startForecastRestockAutomationWorker(
  intervalMs = DEFAULT_RECONCILE_INTERVAL_MS
) {
  if (workerTimer) return;

  const safeIntervalMs = Math.max(5_000, Math.trunc(intervalMs));
  void reconcileStandaloneForecastTicket();

  workerTimer = setInterval(() => {
    void reconcileStandaloneForecastTicket();
  }, safeIntervalMs);
  workerTimer.unref();

  console.info(
    `[restock] Standalone forecast ticket automation started (interval=${safeIntervalMs}ms).`
  );
}

export function stopForecastRestockAutomationWorker() {
  if (!workerTimer) return;
  clearInterval(workerTimer);
  workerTimer = null;
}
