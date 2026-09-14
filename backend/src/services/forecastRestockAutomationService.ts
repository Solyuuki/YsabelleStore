import { RestockOrderStatus } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { listRestockPlanningCandidates } from "./restockPlanningService.js";
import { approveRestockOrder, createRestockOrder } from "./restockService.js";

const AUTOMATION_PAGE_SIZE = 100;
const inFlightByBatch = new Map<string, Promise<ForecastRestockAutomationResult>>();

type ForecastRestockAutomationResult = {
  orderId: string | null;
  orderNumber: string | null;
  status: "CREATED" | "EXISTING" | "NO_ACTION" | "NO_ACTOR";
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
  const lines: Array<{
    productId: string;
    quantity: number;
  }> = [];
  let page = 1;

  while (true) {
    const result = await listRestockPlanningCandidates({
      includeZero: false,
      page,
      pageSize: AUTOMATION_PAGE_SIZE
    });

    for (const candidate of result.items) {
      const suggestedQuantity = candidate.forecastDecision?.suggestedQuantity ?? 0;
      if (candidate.forecast?.batchId !== batchId || suggestedQuantity <= 0) continue;

      lines.push({
        productId: candidate.product.id,
        quantity: suggestedQuantity
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

  const actorId = await findAutomationActorId();
  if (!actorId) {
    console.warn(`[restock] Forecast batch ${batchId} has no active user to own its automated ticket.`);
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

  const actionLines = await loadForecastActionLines(batchId);
  if (actionLines.length === 0) {
    return { orderId: null, orderNumber: null, status: "NO_ACTION" };
  }

  const order = await createRestockOrder(
    {
      notes: `${marker} Automatically generated from the active demand forecast.`,
      lines: actionLines.map((line) => ({
        isSelected: true,
        notes: `Forecast-generated restock from batch ${batchId}.`,
        ownerOverrideReason: null,
        productId: line.productId,
        recommendationId: null,
        recommendationSource: "SARIMA" as const,
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
