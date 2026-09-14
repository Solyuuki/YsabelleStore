import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "../database/prismaClient.js";
import {
  requestForecastRefresh,
  waitForForecastRefresh
} from "../modules/forecasting/forecast.service.js";
import { ensureForecastRestockTicket } from "../services/forecastRestockAutomationService.js";
import { listRestockPlanningCandidates } from "../services/restockPlanningService.js";

const QA_PREFIX = "qa-forecast-restock:";
const SNAPSHOT_PATH = path.resolve(process.cwd(), ".data/qa-forecast-restock-snapshot.json");
const TARGET_SKUS = ["SARIMA-P087", "SARIMA-P013", "SARIMA-P121", "SARIMA-P085", "SARIMA-P266"];
const HISTORY_MONTHS = 24;

type QaSnapshot = {
  createdAt: string;
  forecastBatchId: string | null;
  orderId: string | null;
  previousActiveBatch: {
    id: string;
    status: "READY" | "EMPTY";
  } | null;
  seededActiveKeys: string[];
};

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function completedMonths(count: number, now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return Array.from({ length: count }, (_, index) => {
    const month = new Date(start);
    month.setUTCMonth(month.getUTCMonth() - (count - index));
    return month;
  });
}

async function readSnapshot() {
  try {
    return JSON.parse(await readFile(SNAPSHOT_PATH, "utf8")) as QaSnapshot;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeSnapshot(snapshot: QaSnapshot) {
  await mkdir(path.dirname(SNAPSHOT_PATH), { recursive: true });
  await writeFile(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

async function loadQaProducts() {
  const products = await prisma.product.findMany({
    orderBy: { sku: "asc" },
    select: {
      id: true,
      name: true,
      sellingPrice: true,
      sku: true
    },
    where: {
      dataQualityStatus: { not: "REJECTED" },
      recordSource: { not: "TEST_FIXTURE" },
      sku: { in: TARGET_SKUS },
      status: { not: "DISCONTINUED" }
    }
  });
  const bySku = new Map(products.map((product) => [product.sku, product]));
  const missing = TARGET_SKUS.filter((sku) => !bySku.has(sku));
  if (missing.length > 0) {
    throw new Error(`QA forecast-restock products are missing: ${missing.join(", ")}`);
  }
  return TARGET_SKUS.map((sku) => bySku.get(sku)!);
}

async function seed() {
  const existingSnapshot = await readSnapshot();
  if (existingSnapshot) {
    throw new Error(
      "A forecast-restock QA scenario is already seeded. Run `npm run qa:forecast-restock:reset` first."
    );
  }

  await prisma.historicalMonthlySales.deleteMany({
    where: { activeKey: { startsWith: QA_PREFIX } }
  });

  const products = await loadQaProducts();
  const previousActive = await prisma.forecastBatchCache.findFirst({
    orderBy: { generatedAt: "desc" },
    select: { id: true, status: true },
    where: { isActive: true, status: { in: ["READY", "EMPTY"] } }
  });
  const months = completedMonths(HISTORY_MONTHS);
  const historyRows = products.flatMap((product, productIndex) =>
    months.map((period, monthIndex) => {
      const quantitySold = 90 + productIndex * 8 + (monthIndex % 6) * 5 + (monthIndex % 2) * 3;
      const activeKey = `${QA_PREFIX}${product.id}:${monthKey(period)}`;
      const unitPrice = Number(product.sellingPrice);
      return {
        activeKey,
        isActive: true,
        period,
        productId: product.id,
        quantitySold,
        salesAmount: quantitySold * unitPrice,
        source: "IMPORTED_HISTORICAL" as const,
        unitPrice
      };
    })
  );

  await prisma.historicalMonthlySales.createMany({ data: historyRows });
  const snapshot: QaSnapshot = {
    createdAt: new Date().toISOString(),
    forecastBatchId: null,
    orderId: null,
    previousActiveBatch: previousActive
      ? { id: previousActive.id, status: previousActive.status as "READY" | "EMPTY" }
      : null,
    seededActiveKeys: historyRows.map((row) => row.activeKey)
  };
  await writeSnapshot(snapshot);

  try {
    console.log(
      `[qa:forecast-restock] Seeded ${historyRows.length} real historical demand rows across ${products.length} products.`
    );
    await requestForecastRefresh({
      force: true,
      productIds: products.map((product) => product.id)
    });
    const active = await waitForForecastRefresh();
    if (!active || active.status !== "READY") {
      throw new Error("Forecast refresh did not produce an active READY batch.");
    }

    snapshot.forecastBatchId = active.id;
    await writeSnapshot(snapshot);

    const planning = await listRestockPlanningCandidates({
      includeZero: true,
      page: 1,
      pageSize: 100
    });
    const targetIds = new Set(products.map((product) => product.id));
    const qaCandidates = planning.items.filter((candidate) => targetIds.has(candidate.product.id));
    const actionable = qaCandidates.filter(
      (candidate) =>
        candidate.forecast?.batchId === active.id && candidate.recommendedQuantity > 0
    );
    const lowStock = qaCandidates.filter((candidate) => candidate.stockHealth.status === "LOW_STOCK");

    if (actionable.length !== products.length) {
      const blocked = qaCandidates
        .filter((candidate) => candidate.recommendedQuantity <= 0)
        .map((candidate) => candidate.product.sku);
      throw new Error(
        `QA forecast batch is not actionable for all target products. Blocked: ${blocked.join(", ") || "unknown"}.`
      );
    }
    if (lowStock.length !== products.length) {
      const notLow = qaCandidates
        .filter((candidate) => candidate.stockHealth.status !== "LOW_STOCK")
        .map((candidate) => `${candidate.product.sku}=${candidate.stockHealth.status}`);
      throw new Error(`QA products did not classify as Low Stock: ${notLow.join(", ")}.`);
    }

    const ticket = await ensureForecastRestockTicket(active.id);
    if (!ticket.orderId || !ticket.orderNumber || ticket.status === "NO_ACTION") {
      throw new Error(`Automated forecast ticket was not created for batch ${active.id}.`);
    }
    snapshot.orderId = ticket.orderId;
    await writeSnapshot(snapshot);

    const units = actionable.reduce(
      (sum, candidate) => sum + Math.max(0, candidate.recommendedQuantity),
      0
    );
    console.log(
      `[qa:forecast-restock] READY batch ${active.id}: ${actionable.length} Low Stock products, ${units} recommended unit(s).`
    );
    console.log(
      `[qa:forecast-restock] Automated ticket ${ticket.orderNumber} is available in Reports and Receiving.`
    );
    console.log("[qa:forecast-restock] Reset with: npm run qa:forecast-restock:reset");
  } catch (error) {
    console.error(
      "[qa:forecast-restock] Seed failed. Run `npm run qa:forecast-restock:reset` before retrying."
    );
    throw error;
  }
}

async function reset() {
  const snapshot = await readSnapshot();
  const batchId = snapshot?.forecastBatchId ?? null;
  const qaOrders = batchId
    ? await prisma.restockOrder.findMany({
        select: {
          id: true,
          orderNumber: true,
          status: true,
          lines: { select: { receivedQuantity: true } }
        },
        where: { notes: { contains: `[ForecastBatch:${batchId}]` } }
      })
    : [];
  const unsafeOrders = qaOrders.filter(
    (order) =>
      order.status === "RECEIVED" ||
      order.status === "PARTIALLY_RECEIVED" ||
      order.lines.some((line) => line.receivedQuantity > 0)
  );
  if (unsafeOrders.length > 0) {
    throw new Error(
      `Cannot reset QA scenario after receiving stock for ${unsafeOrders.map((order) => order.orderNumber).join(", ")}; resetting would corrupt inventory history.`
    );
  }

  await prisma.$transaction(async (tx) => {
    if (qaOrders.length > 0) {
      await tx.restockOrder.deleteMany({
        where: { id: { in: qaOrders.map((order) => order.id) } }
      });
    }

    if (batchId) {
      await tx.forecastProductResult.deleteMany({ where: { batchId } });
      await tx.forecastBatchCache.deleteMany({ where: { id: batchId } });
    }

    await tx.historicalMonthlySales.deleteMany({
      where: { activeKey: { startsWith: QA_PREFIX } }
    });

    if (snapshot?.previousActiveBatch) {
      const previous = await tx.forecastBatchCache.findUnique({
        select: { id: true },
        where: { id: snapshot.previousActiveBatch.id }
      });
      if (previous) {
        await tx.forecastBatchCache.updateMany({
          data: { isActive: false },
          where: { isActive: true }
        });
        await tx.forecastBatchCache.update({
          data: {
            isActive: true,
            status: snapshot.previousActiveBatch.status
          },
          where: { id: snapshot.previousActiveBatch.id }
        });
      }
    }
  });

  await rm(SNAPSHOT_PATH, { force: true });
  console.log(
    `[qa:forecast-restock] Reset complete. Removed ${qaOrders.length} QA ticket(s) and restored the previous forecast batch when available.`
  );
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
