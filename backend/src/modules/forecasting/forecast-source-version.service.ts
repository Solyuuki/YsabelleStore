import { createHash } from "node:crypto";
import fs from "node:fs";

import { prisma } from "../../database/prismaClient.js";
import type { ForecastInputSource } from "./forecast.types.js";
import { getActiveForecastMonth, monthStartIso } from "./forecast-window.js";
import { resolveRepositoryPath } from "./repository-paths.js";

const FORECAST_INPUT_CONTRACT_VERSION = "forecast-input-v2";
const WORKBOOK_PATHS = [
  "data/forecasting/historical-sales-2024.xlsx",
  "data/forecasting/historical-sales-2025.xlsx"
] as const;

type WorkbookHashCacheEntry = {
  signature: string;
  hash: string;
};

const workbookHashCache = new Map<string, WorkbookHashCacheEntry>();
const SOURCE_SNAPSHOT_TTL_MS = 5_000;
let cachedSourceSnapshot: { expiresAt: number; value: ForecastSourceSnapshot } | null = null;
let sourceSnapshotPromise: Promise<ForecastSourceSnapshot> | null = null;

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function workbookHash(relativePath: string) {
  const absolutePath = resolveRepositoryPath(relativePath);

  if (!fs.existsSync(absolutePath)) {
    return "missing";
  }

  const stat = fs.statSync(absolutePath);
  const signature = `${stat.size}:${stat.mtimeMs}`;
  const cached = workbookHashCache.get(absolutePath);

  if (cached?.signature === signature) {
    return cached.hash;
  }

  const hash = sha256(fs.readFileSync(absolutePath));
  workbookHashCache.set(absolutePath, { hash, signature });
  return hash;
}

function dateValue(value: Date | null | undefined) {
  return value?.toISOString() ?? null;
}

export type ForecastSourceSnapshot = {
  activeForecastMonth: string;
  databaseRevision: string;
  workbookRevision: string;
};

async function loadForecastSourceSnapshot(): Promise<ForecastSourceSnapshot> {
  const [historical, sales, saleItems, products, imports] = await Promise.all([
    prisma.historicalMonthlySales.aggregate({
      _count: { _all: true },
      _max: { updatedAt: true },
      _sum: { quantitySold: true },
      where: { isActive: true, source: "IMPORTED_HISTORICAL" }
    }),
    prisma.sale.aggregate({
      _count: { _all: true },
      _max: { saleDate: true, updatedAt: true },
      where: { status: "COMPLETED" }
    }),
    prisma.saleItem.aggregate({
      _count: { _all: true },
      _sum: { quantity: true },
      where: { sale: { status: "COMPLETED" } }
    }),
    prisma.product.aggregate({
      _count: { _all: true },
      _max: { updatedAt: true }
    }),
    prisma.historicalSalesImportBatch.aggregate({
      _count: { _all: true },
      _max: { completedAt: true, rolledBackAt: true },
      where: { status: { in: ["COMPLETED", "COMPLETED_WITH_SKIPS", "ROLLED_BACK"] } }
    })
  ]);

  const databaseRevision = sha256(
    JSON.stringify({
      contract: FORECAST_INPUT_CONTRACT_VERSION,
      historical: {
        count: historical._count._all,
        quantity: historical._sum.quantitySold ?? 0,
        updatedAt: dateValue(historical._max.updatedAt)
      },
      imports: {
        completedAt: dateValue(imports._max.completedAt),
        count: imports._count._all,
        rolledBackAt: dateValue(imports._max.rolledBackAt)
      },
      products: {
        count: products._count._all,
        updatedAt: dateValue(products._max.updatedAt)
      },
      saleItems: {
        count: saleItems._count._all,
        quantity: saleItems._sum.quantity ?? 0
      },
      sales: {
        count: sales._count._all,
        saleDate: dateValue(sales._max.saleDate),
        updatedAt: dateValue(sales._max.updatedAt)
      }
    })
  );
  const workbookRevision = sha256(
    JSON.stringify({
      contract: FORECAST_INPUT_CONTRACT_VERSION,
      workbooks: WORKBOOK_PATHS.map((path) => workbookHash(path))
    })
  );

  return {
    activeForecastMonth: monthStartIso(getActiveForecastMonth()),
    databaseRevision,
    workbookRevision
  };
}

export function invalidateForecastSourceSnapshot() {
  cachedSourceSnapshot = null;
}

export async function getForecastSourceSnapshot(): Promise<ForecastSourceSnapshot> {
  const activeForecastMonth = monthStartIso(getActiveForecastMonth());
  if (
    cachedSourceSnapshot &&
    cachedSourceSnapshot.expiresAt > Date.now() &&
    cachedSourceSnapshot.value.activeForecastMonth === activeForecastMonth
  ) {
    return cachedSourceSnapshot.value;
  }

  sourceSnapshotPromise ??= loadForecastSourceSnapshot();
  try {
    const value = await sourceSnapshotPromise;
    cachedSourceSnapshot = { expiresAt: Date.now() + SOURCE_SNAPSHOT_TTL_MS, value };
    return value;
  } finally {
    sourceSnapshotPromise = null;
  }
}

export function sourceVersionFor(source: ForecastInputSource, snapshot: ForecastSourceSnapshot) {
  return sha256(
    JSON.stringify({
      activeForecastMonth: snapshot.activeForecastMonth,
      contract: FORECAST_INPUT_CONTRACT_VERSION,
      databaseRevision: snapshot.databaseRevision,
      source,
      workbookRevision: source === "WORKBOOK_FALLBACK" ? snapshot.workbookRevision : null
    })
  );
}
