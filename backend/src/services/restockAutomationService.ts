import { createHash } from "node:crypto";

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
const TERMINAL_TICKET_STATUSES = new Set<RestockOrderStatus>([
  RestockOrderStatus.RECEIVED,
  RestockOrderStatus.CANCELLED
]);
let inFlightAutomation: Promise<RestockAutomationResult> | null = null;
let workerTimer: NodeJS.Timeout | null = null;
let workerReconciliation: Promise<void> | null = null;

type RestockAutomationStatus =
  | "CREATED"
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
  recommendationSource: "LOW_STOCK" | "TARGET_STOCK";
};

type RestockTicketIdentity = {
  id: string;
  orderNumber: string;
  status: RestockOrderStatus;
  version: number;
};

function automationFingerprint(lines: RestockActionLine[]) {
  const payload = [...lines]
    .sort((left, right) => left.productId.localeCompare(right.productId))
    .map((line) => `${line.productId}:${line.recommendationSource}:${line.quantity}`)
    .join("|");
  return createHash("sha256").update(payload).digest("hex").slice(0, 24);
}

function automationMarker(fingerprint: string) {
  return `[AutomatedRestock:${fingerprint}]`;
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
        candidate.recommendationSource !== "LOW_STOCK" &&
        candidate.recommendationSource !== "TARGET_STOCK"
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

async function loadExistingAutomatedTickets(
  fingerprint: string
): Promise<RestockTicketIdentity[]> {
  return await prisma.restockOrder.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      orderNumber: true,
      status: true,
      version: true
    },
    where: { notes: { contains: automationMarker(fingerprint) } }
  });
}

function liveAutomatedTicket(orders: RestockTicketIdentity[]) {
  return orders.find((order) => LIVE_TICKET_STATUSES.has(order.status)) ?? null;
}

function latestTerminalAutomatedTicket(orders: RestockTicketIdentity[]) {
  return orders.find((order) => TERMINAL_TICKET_STATUSES.has(order.status)) ?? null;
}

async function runRestockAutomation(): Promise<RestockAutomationResult> {
  const actionLines = await loadOperationalActionLines();
  const totalUnits = actionLines.reduce((sum, line) => sum + line.quantity, 0);

  if (actionLines.length === 0) {
    return { orderId: null, orderNumber: null, status: "NO_ACTION" };
  }

  const fingerprint = automationFingerprint(actionLines);
  const existingOrders = await loadExistingAutomatedTickets(fingerprint);
  const live = liveAutomatedTicket(existingOrders);

  if (live && live.status !== RestockOrderStatus.DRAFT) {
    console.info(
      `[restock] Operational plan already has active ticket ${live.orderNumber} (${live.status}).`
    );
    return {
      orderId: live.id,
      orderNumber: live.orderNumber,
      status: "EXISTING"
    };
  }

  const actorId = await findAutomationActorId();
  if (!actorId) {
    console.warn("[restock] No active user is available to own the automated restock ticket.");
    return { orderId: null, orderNumber: null, status: "NO_ACTOR" };
  }

  if (live?.status === RestockOrderStatus.DRAFT) {
    const approved = await approveRestockOrder(live.id, { expectedVersion: live.version }, actorId);
    console.info(
      `[restock] Recovered automated draft ${approved.orderNumber} and auto-approved it for Receiving.`
    );
    return {
      orderId: approved.id,
      orderNumber: approved.orderNumber,
      status: "CREATED"
    };
  }

  const latestTerminal = latestTerminalAutomatedTicket(existingOrders);
  if (latestTerminal?.status === RestockOrderStatus.CANCELLED) {
    console.info(
      `[restock] Operational plan remains suppressed by cancelled ticket ${latestTerminal.orderNumber}.`
    );
    return {
      orderId: latestTerminal.id,
      orderNumber: latestTerminal.orderNumber,
      status: "CANCELLED"
    };
  }

  const marker = automationMarker(fingerprint);
  const order = await createRestockOrder(
    {
      notes: `${marker} Automatically generated from the operational restock forecast.`,
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

  const approved = await approveRestockOrder(order.id, { expectedVersion: order.version }, actorId);
  console.info(
    `[restock] Operational forecast generated and auto-approved ${approved.orderNumber} with ${actionLines.length} product(s), ${totalUnits} unit(s).`
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
      if (result.status === "CREATED" && result.orderNumber) {
        console.info(`[restock] Automated restock created ${result.orderNumber} for Receiving.`);
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
