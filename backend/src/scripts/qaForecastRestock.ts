import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { InventoryBatchStatus, RestockOrderStatus } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { waitForForecastRefresh } from "../modules/forecasting/forecast.service.js";
import { computeStockStatus } from "../services/catalogSerializers.js";
import { ensureForecastRestockTicket } from "../services/forecastRestockAutomationService.js";
import { listRestockPlanningCandidates } from "../services/restockPlanningService.js";
import { applyStockAdjustment } from "../services/stockDomainService.js";

const LEGACY_QA_PREFIX = "qa-forecast-restock:";
const QA_MOVEMENT_REFERENCE_TYPE = "QA_FORECAST_RESTOCK";
const SNAPSHOT_PATH = path.resolve(process.cwd(), ".data/qa-forecast-restock-snapshot.json");
const DESIRED_QA_PRODUCT_COUNT = 5;
const PREFERRED_SKUS = [
  "SARIMA-P087",
  "SARIMA-P013",
  "SARIMA-P121",
  "SARIMA-P085",
  "SARIMA-P266"
];

type PlanningCandidate = Awaited<
  ReturnType<typeof listRestockPlanningCandidates>
>["items"][number];

type ActiveForecastSnapshot = {
  id: string;
  status: "READY" | "EMPTY";
};

type QaBatchSnapshot = {
  id: string;
  quantityRemaining: number;
  status: InventoryBatchStatus;
};

type QaProductSnapshot = {
  batches: QaBatchSnapshot[];
  id: string;
  inventory: {
    id: string;
    lastStockUpdatedAt: string | null;
    quantityOnHand: number;
    version: number;
  };
  name: string;
  originalSellableStock: number;
  qaSellableStock: number;
  reorderLevel: number;
  sku: string;
  targetStockLevel: number;
};

type QaSnapshotV2 = {
  version: 2;
  createdAt: string;
  scenarioId: string;
  baselineForecastBatchId: string;
  createdForecastBatchIds: string[];
  orderId: string | null;
  previousActiveBatch: ActiveForecastSnapshot | null;
  products: QaProductSnapshot[];
};

type LegacyQaSnapshot = {
  createdAt?: string;
  forecastBatchId?: string | null;
  orderId?: string | null;
  previousActiveBatch?: ActiveForecastSnapshot | null;
  seededActiveKeys?: string[];
};

type QaSnapshot = QaSnapshotV2 | LegacyQaSnapshot;

function isV2Snapshot(snapshot: QaSnapshot): snapshot is QaSnapshotV2 {
  return "version" in snapshot && snapshot.version === 2;
}

async function readSnapshot() {
  try {
    return JSON.parse(await readFile(SNAPSHOT_PATH, "utf8")) as QaSnapshot;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeSnapshot(snapshot: QaSnapshotV2) {
  await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
  await writeFile(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

async function loadAllPlanningCandidates() {
  const pageSize = 100;
  const items: PlanningCandidate[] = [];
  let page = 1;

  while (true) {
    const result = await listRestockPlanningCandidates({
      includeZero: true,
      page,
      pageSize
    });
    items.push(...result.items);
    if (page >= result.meta.totalPages) return items;
    page += 1;
  }
}

async function findActiveForecast() {
  return await prisma.forecastBatchCache.findFirst({
    orderBy: { generatedAt: "desc" },
    select: { id: true, status: true },
    where: { isActive: true, status: { in: ["READY", "EMPTY"] } }
  });
}

async function ensureReadyBaselineForecast() {
  const previousActive = await findActiveForecast();
  if (previousActive?.status === "READY") {
    return {
      baseline: previousActive as ActiveForecastSnapshot,
      createdForecastBatchIds: [] as string[],
      previousActive: previousActive as ActiveForecastSnapshot
    };
  }

  console.log(
    "[qa:forecast-restock] No active READY forecast exists; generating one from the store's existing demand data."
  );
  const generated = await waitForForecastRefresh({ force: true });
  if (!generated || generated.status !== "READY") {
    throw new Error(
      "The real forecast pipeline did not produce a READY batch. QA will not fabricate historical demand."
    );
  }

  return {
    baseline: { id: generated.id, status: "READY" as const },
    createdForecastBatchIds: [generated.id],
    previousActive: previousActive
      ? ({ id: previousActive.id, status: previousActive.status } as ActiveForecastSnapshot)
      : null
  };
}

function preferredSkuRank(sku: string) {
  const rank = PREFERRED_SKUS.indexOf(sku);
  return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
}

function qaSellableTarget(candidate: PlanningCandidate) {
  if (candidate.product.reorderLevel <= 0 || candidate.sellableStock <= 1) return null;

  const inventoryLowStockTarget = Math.max(
    1,
    Math.min(candidate.product.reorderLevel, candidate.sellableStock - 1)
  );
  const monthlyDemand = candidate.stockHealth.monthlyDemand;
  const coverageLowStockTarget =
    monthlyDemand !== null && monthlyDemand > 0
      ? Math.max(1, Math.floor(monthlyDemand * 0.5))
      : inventoryLowStockTarget;

  const target = Math.min(inventoryLowStockTarget, coverageLowStockTarget);
  return target < candidate.sellableStock ? target : null;
}

function candidateDiagnostic(candidate: PlanningCandidate) {
  return [
    candidate.product.sku,
    `sellable=${candidate.sellableStock}`,
    `reorder=${candidate.product.reorderLevel}`,
    `target=${candidate.product.targetStockLevel}`,
    `incoming=${candidate.incomingStock}`,
    `forecastDemand=${Math.ceil(candidate.forecastDecision?.currentMonthDemand ?? 0)}`,
    `forecastSuggested=${candidate.forecastDecision?.suggestedQuantity ?? 0}`,
    `recommended=${candidate.recommendedQuantity}`,
    `source=${candidate.recommendationSource}`,
    `stockHealth=${candidate.stockHealth.status}`
  ].join(" ");
}

async function loadEligibleQaProducts(baselineBatchId: string) {
  const planning = await loadAllPlanningCandidates();
  const forecastCandidates = planning.filter(
    (candidate) => candidate.forecast?.batchId === baselineBatchId
  );
  if (forecastCandidates.length === 0) {
    throw new Error(
      `Active forecast batch ${baselineBatchId} is not mapped to any operational catalog product.`
    );
  }

  const productRows = await prisma.product.findMany({
    select: {
      id: true,
      inventory: {
        select: {
          id: true,
          lastStockUpdatedAt: true,
          quantityOnHand: true,
          version: true
        }
      },
      inventoryBatches: {
        orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          quantityRemaining: true,
          status: true
        }
      },
      name: true,
      reorderLevel: true,
      sku: true,
      status: true,
      targetStockLevel: true
    },
    where: {
      dataQualityStatus: { not: "REJECTED" },
      id: { in: forecastCandidates.map((candidate) => candidate.product.id) },
      recordSource: { not: "TEST_FIXTURE" },
      status: "ACTIVE"
    }
  });
  const productById = new Map(productRows.map((product) => [product.id, product]));

  const eligible = forecastCandidates
    .flatMap((candidate) => {
      const product = productById.get(candidate.product.id);
      const qaStock = qaSellableTarget(candidate);
      if (
        !product?.inventory ||
        qaStock === null ||
        candidate.incomingStock > 0 ||
        candidate.sellableStock <= qaStock
      ) {
        return [];
      }

      const projectedForecastNeed = Math.max(
        0,
        Math.ceil(
          candidate.product.targetStockLevel +
            (candidate.forecastDecision?.currentMonthDemand ?? 0) +
            candidate.expiryRiskQuantity -
            qaStock
        )
      );
      if (projectedForecastNeed <= 0) return [];

      return [{ candidate, product, qaStock }];
    })
    .sort((left, right) => {
      const leftHasRecentDemand = (left.candidate.stockHealth.monthlyDemand ?? 0) > 0 ? 0 : 1;
      const rightHasRecentDemand = (right.candidate.stockHealth.monthlyDemand ?? 0) > 0 ? 0 : 1;
      if (leftHasRecentDemand !== rightHasRecentDemand) {
        return leftHasRecentDemand - rightHasRecentDemand;
      }

      const preferredDifference =
        preferredSkuRank(left.candidate.product.sku) - preferredSkuRank(right.candidate.product.sku);
      if (preferredDifference !== 0) return preferredDifference;

      const demandDifference =
        (right.candidate.forecastDecision?.currentMonthDemand ?? 0) -
        (left.candidate.forecastDecision?.currentMonthDemand ?? 0);
      if (demandDifference !== 0) return demandDifference;
      return right.candidate.sellableStock - left.candidate.sellableStock;
    });

  if (eligible.length === 0) {
    console.error("[qa:forecast-restock] Forecast-backed product diagnostics:");
    for (const candidate of forecastCandidates.slice(0, 20)) {
      console.error(`  - ${candidateDiagnostic(candidate)}`);
    }
    throw new Error(
      "No real forecast-backed product can be safely moved to Low Stock. Products with incoming supplier stock are intentionally excluded."
    );
  }

  return eligible.slice(0, DESIRED_QA_PRODUCT_COUNT);
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
  return fallback?.id;
}

function snapshotProduct(
  entry: Awaited<ReturnType<typeof loadEligibleQaProducts>>[number]
): QaProductSnapshot {
  const inventory = entry.product.inventory;
  if (!inventory) {
    throw new Error(`Inventory record is missing for ${entry.product.sku}.`);
  }

  return {
    batches: entry.product.inventoryBatches.map((batch) => ({
      id: batch.id,
      quantityRemaining: batch.quantityRemaining,
      status: batch.status
    })),
    id: entry.product.id,
    inventory: {
      id: inventory.id,
      lastStockUpdatedAt: inventory.lastStockUpdatedAt?.toISOString() ?? null,
      quantityOnHand: inventory.quantityOnHand,
      version: inventory.version
    },
    name: entry.product.name,
    originalSellableStock: entry.candidate.sellableStock,
    qaSellableStock: entry.qaStock,
    reorderLevel: entry.product.reorderLevel,
    sku: entry.product.sku,
    targetStockLevel: entry.product.targetStockLevel
  };
}

async function assertQaPlanningState(batchId: string, selected: QaProductSnapshot[]) {
  const planning = await loadAllPlanningCandidates();
  const selectedIds = new Set(selected.map((product) => product.id));
  const candidates = planning.filter((candidate) => selectedIds.has(candidate.product.id));
  const byId = new Map(candidates.map((candidate) => [candidate.product.id, candidate]));
  const failures: string[] = [];

  for (const product of selected) {
    const candidate = byId.get(product.id);
    if (!candidate) {
      failures.push(`${product.sku}: missing from restock planning`);
      continue;
    }

    const inventoryStatus = computeStockStatus(
      candidate.sellableStock,
      candidate.product.reorderLevel
    );
    if (candidate.forecast?.batchId !== batchId) {
      failures.push(`${product.sku}: not attached to forecast batch ${batchId}`);
    }
    if (inventoryStatus !== "LOW_STOCK") {
      failures.push(
        `${product.sku}: inventory status=${inventoryStatus}, sellable=${candidate.sellableStock}, reorder=${candidate.product.reorderLevel}`
      );
    }
    if (candidate.recommendedQuantity <= 0) {
      failures.push(`${product.sku}: recommendedQuantity=${candidate.recommendedQuantity}`);
    }
  }

  if (failures.length > 0) {
    console.error("[qa:forecast-restock] Planning verification failed:");
    for (const candidate of candidates) {
      console.error(`  - ${candidateDiagnostic(candidate)}`);
    }
    throw new Error(failures.join("; "));
  }

  return candidates;
}

async function seed() {
  const existingSnapshot = await readSnapshot();
  if (existingSnapshot) {
    throw new Error(
      "A forecast-restock QA scenario is already seeded. Run `npm run qa:forecast-restock:reset` first."
    );
  }

  // Old QA versions fabricated historical monthly sales. Remove only their explicitly-prefixed
  // rows before starting the stock-based scenario.
  await prisma.historicalMonthlySales.deleteMany({
    where: { activeKey: { startsWith: LEGACY_QA_PREFIX } }
  });

  const baselineContext = await ensureReadyBaselineForecast();
  const selectedEntries = await loadEligibleQaProducts(baselineContext.baseline.id);
  const scenarioId = `qa-forecast-restock-${randomUUID()}`;
  const snapshot: QaSnapshotV2 = {
    baselineForecastBatchId: baselineContext.baseline.id,
    createdAt: new Date().toISOString(),
    createdForecastBatchIds: [...baselineContext.createdForecastBatchIds],
    orderId: null,
    previousActiveBatch: baselineContext.previousActive,
    products: selectedEntries.map(snapshotProduct),
    scenarioId,
    version: 2
  };
  await writeSnapshot(snapshot);

  try {
    const actorId = await findAutomationActorId();
    console.log(
      `[qa:forecast-restock] Using ${snapshot.products.length} real catalog product(s) from forecast batch ${snapshot.baselineForecastBatchId}.`
    );

    for (const product of snapshot.products) {
      const reduction = product.originalSellableStock - product.qaSellableStock;
      if (reduction <= 0) continue;

      await prisma.$transaction(async (tx) => {
        await applyStockAdjustment(tx, {
          direction: "OUT",
          performedById: actorId,
          productId: product.id,
          quantity: reduction,
          reason: `QA forecast-restock: lower ${product.sku} to its real Low Stock threshold.`,
          referenceId: scenarioId,
          referenceType: QA_MOVEMENT_REFERENCE_TYPE
        });
      });
      console.log(
        `[qa:forecast-restock] ${product.sku}: sellable ${product.originalSellableStock} -> ${product.qaSellableStock} (reorder ${product.reorderLevel}).`
      );
    }

    await assertQaPlanningState(snapshot.baselineForecastBatchId, snapshot.products);

    // Inventory does not alter forecast demand. Force a fresh batch from the store's existing
    // demand source so the READY-batch activation hook sees the QA Low Stock state and creates
    // a brand-new automated ticket through the same production path.
    const refreshed = await waitForForecastRefresh({ force: true });
    if (!refreshed || refreshed.status !== "READY") {
      throw new Error("The real forecast refresh did not produce a READY batch after stock setup.");
    }
    if (!snapshot.createdForecastBatchIds.includes(refreshed.id)) {
      snapshot.createdForecastBatchIds.push(refreshed.id);
      await writeSnapshot(snapshot);
    }

    const actionable = await assertQaPlanningState(refreshed.id, snapshot.products);
    const ticket = await ensureForecastRestockTicket(refreshed.id);
    if (!ticket.orderId || !ticket.orderNumber || ["NO_ACTION", "NO_ACTOR", "CANCELLED"].includes(ticket.status)) {
      throw new Error(
        `Automated forecast ticket was not available for QA batch ${refreshed.id} (status=${ticket.status}).`
      );
    }

    const order = await prisma.restockOrder.findUnique({
      select: {
        id: true,
        orderNumber: true,
        status: true,
        lines: { select: { productId: true, requestedQuantity: true } }
      },
      where: { id: ticket.orderId }
    });
    if (!order || ![RestockOrderStatus.APPROVED, RestockOrderStatus.AWAITING_DELIVERY].includes(order.status)) {
      throw new Error(`QA ticket ${ticket.orderNumber} is not ready for Receiving.`);
    }

    const orderProductIds = new Set(order.lines.map((line) => line.productId));
    const missingOrderLines = snapshot.products.filter((product) => !orderProductIds.has(product.id));
    if (missingOrderLines.length > 0) {
      throw new Error(
        `QA ticket ${order.orderNumber} is missing Low Stock product(s): ${missingOrderLines.map((product) => product.sku).join(", ")}.`
      );
    }

    snapshot.orderId = order.id;
    await writeSnapshot(snapshot);

    const selectedIds = new Set(snapshot.products.map((product) => product.id));
    const selectedUnits = actionable
      .filter((candidate) => selectedIds.has(candidate.product.id))
      .reduce((sum, candidate) => sum + Math.max(0, candidate.recommendedQuantity), 0);
    const coverageLowStockCount = actionable.filter(
      (candidate) =>
        selectedIds.has(candidate.product.id) && candidate.stockHealth.status === "LOW_STOCK"
    ).length;

    console.log(
      `[qa:forecast-restock] READY batch ${refreshed.id}: ${snapshot.products.length} inventory Low Stock product(s), ${selectedUnits} recommended unit(s).`
    );
    if (coverageLowStockCount < snapshot.products.length) {
      console.log(
        `[qa:forecast-restock] ${coverageLowStockCount}/${snapshot.products.length} also classify Low Stock by recent-demand coverage; the rest have insufficient recent completed-month demand for that secondary classifier.`
      );
    }
    console.log(
      `[qa:forecast-restock] Automated ticket ${order.orderNumber} (${order.status}) is ready in Reports and Receiving.`
    );
    console.log("[qa:forecast-restock] Reset with: npm run qa:forecast-restock:reset");
  } catch (error) {
    console.error(
      "[qa:forecast-restock] Seed failed. The snapshot is preserved; run `npm run qa:forecast-restock:reset` before retrying."
    );
    throw error;
  }
}

async function findQaOrders(batchIds: string[], explicitOrderId?: string | null) {
  const markerFilters = batchIds.map((batchId) => ({
    notes: { contains: `[ForecastBatch:${batchId}]` }
  }));
  const orFilters = [
    ...(explicitOrderId ? [{ id: explicitOrderId }] : []),
    ...markerFilters
  ];
  if (orFilters.length === 0) return [];

  return await prisma.restockOrder.findMany({
    select: {
      id: true,
      orderNumber: true,
      status: true,
      lines: { select: { receivedQuantity: true } }
    },
    where: { OR: orFilters }
  });
}

function assertOrdersSafeToReset(
  orders: Awaited<ReturnType<typeof findQaOrders>>
) {
  const unsafeOrders = orders.filter(
    (order) =>
      order.status === RestockOrderStatus.RECEIVED ||
      order.status === RestockOrderStatus.PARTIALLY_RECEIVED ||
      order.lines.some((line) => line.receivedQuantity > 0)
  );
  if (unsafeOrders.length > 0) {
    throw new Error(
      `Cannot reset QA scenario after receiving stock for ${unsafeOrders.map((order) => order.orderNumber).join(", ")}; resetting would corrupt inventory history.`
    );
  }
}

async function restorePreviousActiveBatch(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  previousActiveBatch: ActiveForecastSnapshot | null | undefined
) {
  if (!previousActiveBatch) return;

  const previous = await tx.forecastBatchCache.findUnique({
    select: { id: true },
    where: { id: previousActiveBatch.id }
  });
  if (!previous) return;

  await tx.forecastBatchCache.updateMany({
    data: { isActive: false },
    where: { isActive: true }
  });
  await tx.forecastBatchCache.update({
    data: {
      isActive: true,
      status: previousActiveBatch.status
    },
    where: { id: previousActiveBatch.id }
  });
}

async function resetLegacySnapshot(snapshot: LegacyQaSnapshot) {
  const batchId = snapshot.forecastBatchId ?? null;
  const qaOrders = await findQaOrders(batchId ? [batchId] : [], snapshot.orderId);
  assertOrdersSafeToReset(qaOrders);

  await prisma.$transaction(async (tx) => {
    if (qaOrders.length > 0) {
      await tx.restockOrder.deleteMany({ where: { id: { in: qaOrders.map((order) => order.id) } } });
    }
    if (batchId) {
      await tx.forecastProductResult.deleteMany({ where: { batchId } });
      await tx.forecastBatchCache.deleteMany({ where: { id: batchId } });
    }
    await tx.historicalMonthlySales.deleteMany({
      where: { activeKey: { startsWith: LEGACY_QA_PREFIX } }
    });
    await restorePreviousActiveBatch(tx, snapshot.previousActiveBatch);
  });

  await rm(SNAPSHOT_PATH, { force: true });
  console.log(
    `[qa:forecast-restock] Legacy QA reset complete. Removed ${qaOrders.length} QA ticket(s), removed fabricated demand rows, and restored the previous forecast when available.`
  );
}

async function resetV2Snapshot(snapshot: QaSnapshotV2) {
  const qaOrders = await findQaOrders(snapshot.createdForecastBatchIds, snapshot.orderId);
  assertOrdersSafeToReset(qaOrders);

  const productIds = snapshot.products.map((product) => product.id);
  const movementsSinceSeed = await prisma.inventoryMovement.findMany({
    select: {
      id: true,
      productId: true,
      referenceId: true,
      referenceType: true,
      type: true
    },
    where: {
      createdAt: { gte: new Date(snapshot.createdAt) },
      productId: { in: productIds }
    }
  });
  const unexpectedMovements = movementsSinceSeed.filter(
    (movement) =>
      movement.referenceType !== QA_MOVEMENT_REFERENCE_TYPE || movement.referenceId !== snapshot.scenarioId
  );
  if (unexpectedMovements.length > 0) {
    throw new Error(
      `Cannot reset QA stock because ${unexpectedMovements.length} non-QA inventory movement(s) occurred on the selected products after seeding (${unexpectedMovements.map((movement) => `${movement.productId}:${movement.type}`).join(", ")}).`
    );
  }

  const qaMovementIds = movementsSinceSeed
    .filter(
      (movement) =>
        movement.referenceType === QA_MOVEMENT_REFERENCE_TYPE &&
        movement.referenceId === snapshot.scenarioId
    )
    .map((movement) => movement.id);
  const createdBatchIds = [...new Set(snapshot.createdForecastBatchIds)];

  await prisma.$transaction(async (tx) => {
    if (qaOrders.length > 0) {
      await tx.restockOrder.deleteMany({ where: { id: { in: qaOrders.map((order) => order.id) } } });
    }
    if (qaMovementIds.length > 0) {
      await tx.inventoryMovement.deleteMany({ where: { id: { in: qaMovementIds } } });
    }

    for (const product of snapshot.products) {
      for (const batch of product.batches) {
        await tx.inventoryBatch.update({
          data: {
            quantityRemaining: batch.quantityRemaining,
            status: batch.status
          },
          where: { id: batch.id }
        });
      }
      await tx.inventory.update({
        data: {
          lastStockUpdatedAt: product.inventory.lastStockUpdatedAt
            ? new Date(product.inventory.lastStockUpdatedAt)
            : null,
          quantityOnHand: product.inventory.quantityOnHand,
          version: product.inventory.version
        },
        where: { id: product.inventory.id }
      });
    }

    if (createdBatchIds.length > 0) {
      await tx.forecastBatchCache.updateMany({
        data: { isActive: false },
        where: { id: { in: createdBatchIds } }
      });
      await tx.forecastProductResult.deleteMany({ where: { batchId: { in: createdBatchIds } } });
      await tx.forecastBatchCache.deleteMany({ where: { id: { in: createdBatchIds } } });
    }
    await tx.historicalMonthlySales.deleteMany({
      where: { activeKey: { startsWith: LEGACY_QA_PREFIX } }
    });
    await restorePreviousActiveBatch(tx, snapshot.previousActiveBatch);
  });

  await rm(SNAPSHOT_PATH, { force: true });
  console.log(
    `[qa:forecast-restock] Reset complete. Restored ${snapshot.products.length} product(s), removed ${qaOrders.length} QA ticket(s), and removed ${qaMovementIds.length} QA stock adjustment(s).`
  );
}

async function reset() {
  const snapshot = await readSnapshot();
  if (!snapshot) {
    const deletedLegacyRows = await prisma.historicalMonthlySales.deleteMany({
      where: { activeKey: { startsWith: LEGACY_QA_PREFIX } }
    });
    console.log(
      `[qa:forecast-restock] No QA snapshot found. Removed ${deletedLegacyRows.count} orphaned legacy QA demand row(s).`
    );
    return;
  }

  if (isV2Snapshot(snapshot)) {
    await resetV2Snapshot(snapshot);
    return;
  }

  await resetLegacySnapshot(snapshot);
}

const command = process.argv[2];

try {
  if (command === "seed") {
    await seed();
  } else if (command === "reset") {
    await reset();
  } else {
    throw new Error("Usage: qaForecastRestock.ts <seed|reset>");
  }
} finally {
  await prisma.$disconnect();
}
