import { RestockOrderStatus } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { listRestockPlanningCandidates } from "./restockPlanningService.js";
import { approveRestockOrder, createRestockOrder } from "./restockService.js";

const AUTOMATION_PAGE_SIZE = 100;
const DEFAULT_RECONCILE_INTERVAL_MS = 30_000;
const inFlightByBatch = new Map<string, Promise<ForecastRestockAutomationResult>>();
let workerTimer: NodeJS.Timeout | null = null;
let workerReconciliation: Promise<void> | null = null;

type ForecastRestockAutomationResult = {
  orderId: string | null;
  orderNumber: string | null;
  status: "CREATED" | "EXISTING" | "NO_ACTION" | "NO_ACTOR";
};

type ForecastRestockActionLine = {
  productId: string;
  quantity: number;
  recommendationId: string | null;
  recommendationSource: "SARIMA";
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

      // The active forecast batch is the source of truth for automated forecast tickets.
      // A product may have a LOW_STOCK/TARGET_STOCK recommendation that takes precedence in
      // planning labels while still belonging to this forecast batch. Do not drop that product
      // from the automated ticket merely because its display recommendation source is not SARIMA.
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

async function runForecastRestockAutomation(
  batchId: string
): Promise<ForecastRestockAutomationResult> {
  const marker = batchMarker(batchId);
  const existing = await prisma.restockOrder.findFirst({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      version: true
    },
    where: { notes: { contains: marker } }
  });

  if (existing && existing.status !== RestockOrderStatus.DRAFT) {
    return {
      orderId: existing.id,
      orderNumber: existing.orderNumber,
      status: "EXISTING"
    };
  }

  const actionLines = await loadForecastActionLines(batchId);
  if (actionLines.length === 0) {
    console.info(`[restock] Forecast batch ${batchId} has no actionable forecast lines.`);
    return { orderId: null, orderNumber: null, status: "NO_ACTION" };
  }

  console.info(
    `[restock] Forecast batch ${batchId} has ${actionLines.length} actionable product(s) for automated ticket generation.`
  );

  const actorId = await findAutomationActorId();
  if (!actorId) {
    console.warn(
      `[restock] Forecast batch ${batchId} has no active user to own its automated ticket.`
    );
    return { orderId: null, orderNumber: null, status: "NO_ACTOR" };
  }

  if (existing) {
    const approved = await approveRestockOrder(
      existing.id,
      { expectedVersion: existing.version },
      actorId
    );
    return {
      orderId: approved.id,
      orderNumber: approved.orderNumber,
      status: "CREATED"
    };
  }

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
    `[restock] Forecast batch ${batchId} generated ${approved.orderNumber} with ${actionLines.length} product(s).`
  );

  return {
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
    return { orderId: null, orderNumber: null, status: "NO_ACTION" } as const;
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
