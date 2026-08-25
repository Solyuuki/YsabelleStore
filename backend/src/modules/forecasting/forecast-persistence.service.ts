import type { ForecastBatchCache, ForecastBatchSource, Prisma } from "@prisma/client";

import { prisma } from "../../database/prismaClient.js";
import type {
  ForecastBatch,
  ForecastFilters,
  ForecastInputSource,
  ForecastProductSummary,
  PaginatedForecastProductsResponse,
  ProductForecastDetail
} from "./forecast.types.js";
import type { ForecastSourceSnapshot } from "./forecast-source-version.service.js";

const PERSISTENCE_CHUNK_SIZE = 100;
const PAGE_CACHE_LIMIT = 50;
const pageCache = new Map<string, PaginatedForecastProductsResponse>();
const detailCache = new Map<string, ProductForecastDetail>();
let activeBatchCache: ForecastBatchCache | null = null;
let lastPersistenceTimings = { activationMs: 0, writeMs: 0 };

function asDate(monthStart: string) {
  return new Date(`${monthStart.slice(0, 10)}T00:00:00.000Z`);
}

function asNumber(value: { toString(): string } | number | null) {
  return value === null ? null : Number(value);
}

function asJson(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function batchSource(source: ForecastInputSource): ForecastBatchSource {
  return source;
}

export function clearForecastReadCaches() {
  pageCache.clear();
  detailCache.clear();
}

export function resetForecastPersistenceMemory() {
  clearForecastReadCaches();
  activeBatchCache = null;
}

export function getLastForecastPersistenceTimings() {
  return { ...lastPersistenceTimings };
}

export async function recoverAbandonedForecastJobs(now = new Date()) {
  return await prisma.forecastBatchCache.updateMany({
    data: {
      errorCode: "PROCESS_RESTARTED",
      failedAt: now,
      status: "FAILED"
    },
    where: { isActive: false, status: "GENERATING" }
  });
}

export async function getActivePersistedForecastBatch() {
  if (activeBatchCache) return activeBatchCache;

  activeBatchCache = await prisma.forecastBatchCache.findFirst({
    orderBy: { generatedAt: "desc" },
    where: { isActive: true, status: { in: ["READY", "EMPTY"] } }
  });
  return activeBatchCache;
}

export async function createGeneratingForecastBatch(
  source: ForecastInputSource,
  sourceVersion: string,
  snapshot: ForecastSourceSnapshot
) {
  return await prisma.forecastBatchCache.create({
    data: {
      databaseRevision: snapshot.databaseRevision,
      forecastStartMonth: asDate(snapshot.activeForecastMonth),
      source: batchSource(source),
      sourceVersion,
      status: "GENERATING"
    }
  });
}

export async function failForecastBatch(batchId: string, errorCode = "GENERATION_FAILED") {
  await prisma.forecastBatchCache.updateMany({
    data: { errorCode, failedAt: new Date(), status: "FAILED" },
    where: { id: batchId, isActive: false, status: "GENERATING" }
  });
}

export async function persistAndActivateForecastBatch(jobId: string, batch: ForecastBatch) {
  const writeStartedAt = performance.now();
  const summaries = new Map(
    batch.products.map((product) => [product.productId, summarizePersistedProduct(product)])
  );

  for (let offset = 0; offset < batch.products.length; offset += PERSISTENCE_CHUNK_SIZE) {
    const products = batch.products.slice(offset, offset + PERSISTENCE_CHUNK_SIZE);
    await prisma.forecastProductResult.createMany({
      data: products.map((product) => {
        const summary = summaries.get(product.productId)!;
        return {
          batchId: jobId,
          category: product.category,
          currentMonthForecastQuantity: summary.currentMonthForecastQuantity,
          detailPayload: asJson(product),
          forecastVariancePercentage: summary.forecastVariancePercentage,
          growthVersus2025: summary.growthVersus2025,
          modelName: product.model,
          productName: product.productName,
          recentHistoricalSalesTotal: summary.recentHistoricalSalesTotal,
          resultStatus: product.status,
          sellingPrice: product.sellingPrice,
          sourceProductId: product.productId,
          totalForecast2026: summary.totalForecast2026,
          totalHistorical2024: summary.totalHistorical2024,
          totalHistorical2025: summary.totalHistorical2025,
          twelveMonthForecastTotal: summary.twelveMonthForecastTotal,
          warningCount: summary.warningCount
        };
      })
    });
  }

  const persistedCount = await prisma.forecastProductResult.count({ where: { batchId: jobId } });
  if (persistedCount !== batch.products.length) {
    await failForecastBatch(jobId, "INCOMPLETE_PERSISTENCE");
    throw new Error(
      `Forecast persistence was incomplete: expected ${batch.products.length}, stored ${persistedCount}.`
    );
  }
  const writeMs = performance.now() - writeStartedAt;

  const generatedAt = batch.generation.generatedAt
    ? new Date(batch.generation.generatedAt)
    : new Date();
  const fallbackProductCount = batch.products.filter(
    (product) => product.model && product.model !== "SARIMA"
  ).length;
  const failedProductCount = batch.products.filter((product) => product.status === "FAILED").length;

  const activationStartedAt = performance.now();
  const activated = await prisma.$transaction(async (tx) => {
    await tx.forecastBatchCache.updateMany({
      data: { isActive: false, status: "SUPERSEDED" },
      where: { id: { not: jobId }, isActive: true, status: { in: ["READY", "EMPTY"] } }
    });
    return await tx.forecastBatchCache.update({
      data: {
        completedAt: new Date(),
        durationMs: Math.max(0, Math.round(batch.generation.durationMs)),
        failedProductCount,
        fallbackProductCount,
        generatedAt,
        generationMetadata: asJson(batch.generation),
        isActive: true,
        status: batch.source === "EMPTY" ? "EMPTY" : "READY",
        successfulProductCount: batch.products.length - failedProductCount,
        totalProductCount: batch.products.length,
        validationMetadata: asJson(batch.validation)
      },
      where: { id: jobId }
    });
  });
  lastPersistenceTimings = {
    activationMs: performance.now() - activationStartedAt,
    writeMs
  };
  activeBatchCache = activated;

  clearForecastReadCaches();
  void cleanupSupersededForecastData(activated.id).catch((error) => {
    console.error("[forecast] Forecast retention cleanup failed.", error);
  });
  return activated;
}

export async function cleanupSupersededForecastData(activeBatchId: string) {
  const previous = await prisma.forecastBatchCache.findFirst({
    orderBy: { generatedAt: "desc" },
    select: { id: true },
    where: { id: { not: activeBatchId }, status: "SUPERSEDED" }
  });
  const protectedIds = [activeBatchId, previous?.id].filter((id): id is string => Boolean(id));
  return await prisma.forecastProductResult.deleteMany({
    where: { batchId: { notIn: protectedIds }, batch: { status: "SUPERSEDED" } }
  });
}

export function summarizePersistedProduct(product: ProductForecastDetail): ForecastProductSummary {
  const sumHistorical = (year: number) =>
    product.historical
      .filter((point) => point.period.startsWith(`${year}-`))
      .reduce((sum, point) => sum + point.quantitySold, 0);
  const totalHistorical2025 = sumHistorical(2025);
  const totalForecast2026 = product.forecast.reduce(
    (sum, point) => sum + point.recommendedQuantity,
    0
  );
  const current = product.forecast[0];

  return {
    category: product.category,
    currentMonthForecastQuantity: current?.recommendedQuantity ?? null,
    forecastVariancePercentage: current?.forecastVariancePercentage ?? null,
    growthVersus2025:
      totalHistorical2025 === 0
        ? null
        : ((totalForecast2026 - totalHistorical2025) / totalHistorical2025) * 100,
    productId: product.productId,
    productName: product.productName,
    recentHistoricalSalesTotal: product.historical
      .slice(-12)
      .reduce((sum, point) => sum + point.quantitySold, 0),
    totalForecast2026,
    totalHistorical2024: sumHistorical(2024),
    totalHistorical2025,
    twelveMonthForecastTotal: totalForecast2026,
    warningCount: product.warnings.length
  };
}

function persistedSummary(row: {
  category: string;
  currentMonthForecastQuantity: { toString(): string } | null;
  forecastVariancePercentage: { toString(): string } | null;
  growthVersus2025: { toString(): string } | null;
  productName: string;
  recentHistoricalSalesTotal: { toString(): string };
  sourceProductId: string;
  totalForecast2026: { toString(): string };
  totalHistorical2024: { toString(): string };
  totalHistorical2025: { toString(): string };
  twelveMonthForecastTotal: { toString(): string };
  warningCount: number;
}): ForecastProductSummary {
  return {
    category: row.category,
    currentMonthForecastQuantity: asNumber(row.currentMonthForecastQuantity),
    forecastVariancePercentage: asNumber(row.forecastVariancePercentage),
    growthVersus2025: asNumber(row.growthVersus2025),
    productId: row.sourceProductId,
    productName: row.productName,
    recentHistoricalSalesTotal: Number(row.recentHistoricalSalesTotal),
    totalForecast2026: Number(row.totalForecast2026),
    totalHistorical2024: Number(row.totalHistorical2024),
    totalHistorical2025: Number(row.totalHistorical2025),
    twelveMonthForecastTotal: Number(row.twelveMonthForecastTotal),
    warningCount: row.warningCount
  };
}

function orderByFor(
  filters: ForecastFilters
): Prisma.ForecastProductResultOrderByWithRelationInput[] {
  const direction = filters.sortDirection;
  const field: keyof Prisma.ForecastProductResultOrderByWithRelationInput =
    filters.sortBy === "productId" ? "sourceProductId" : filters.sortBy;
  return [{ [field]: direction }, { sourceProductId: "asc" }];
}

export async function queryPersistedForecastProducts(
  batch: ForecastBatchCache,
  filters: ForecastFilters,
  delivery: Omit<
    PaginatedForecastProductsResponse,
    "categories" | "generatedAt" | "items" | "page" | "pageSize" | "totalItems" | "totalPages"
  >
) {
  const cacheKey = JSON.stringify([batch.id, filters, delivery.status]);
  const cached = pageCache.get(cacheKey);
  if (cached) return cached;

  const search = filters.search?.trim();
  const where: Prisma.ForecastProductResultWhereInput = {
    batchId: batch.id,
    ...(filters.category ? { category: filters.category } : {}),
    ...(search
      ? {
          OR: [
            { sourceProductId: { contains: search } },
            { productName: { contains: search } },
            { category: { contains: search } }
          ]
        }
      : {})
  };
  const totalItems = await prisma.forecastProductResult.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalItems / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const [rows, categoryRows] = await Promise.all([
    prisma.forecastProductResult.findMany({
      orderBy: orderByFor(filters),
      select: {
        category: true,
        currentMonthForecastQuantity: true,
        forecastVariancePercentage: true,
        growthVersus2025: true,
        productName: true,
        recentHistoricalSalesTotal: true,
        sourceProductId: true,
        totalForecast2026: true,
        totalHistorical2024: true,
        totalHistorical2025: true,
        twelveMonthForecastTotal: true,
        warningCount: true
      },
      skip: (page - 1) * filters.pageSize,
      take: filters.pageSize,
      where
    }),
    prisma.forecastProductResult.findMany({
      distinct: ["category"],
      orderBy: { category: "asc" },
      select: { category: true },
      where: { batchId: batch.id }
    })
  ]);
  const response: PaginatedForecastProductsResponse = {
    ...delivery,
    categories: categoryRows.map((row) => row.category),
    generatedAt: batch.generatedAt?.toISOString() ?? null,
    items: rows.map(persistedSummary),
    page,
    pageSize: filters.pageSize,
    totalItems,
    totalPages
  };

  pageCache.set(cacheKey, response);
  if (pageCache.size > PAGE_CACHE_LIMIT) {
    pageCache.delete(pageCache.keys().next().value ?? "");
  }
  return response;
}

export async function getPersistedForecastDetail(batchId: string, productId: string) {
  const cacheKey = `${batchId}:${productId}`;
  const cached = detailCache.get(cacheKey);
  if (cached) return cached;

  const row = await prisma.forecastProductResult.findUnique({
    select: { detailPayload: true },
    where: { batchId_sourceProductId: { batchId, sourceProductId: productId } }
  });
  if (!row) return null;

  const detail = row.detailPayload as unknown as ProductForecastDetail;
  detailCache.set(cacheKey, detail);
  return detail;
}

export async function loadPersistedForecastBatch(batchId: string): Promise<ForecastBatch | null> {
  const batch = await prisma.forecastBatchCache.findUnique({
    include: { products: { select: { detailPayload: true } } },
    where: { id: batchId }
  });
  if (!batch?.generationMetadata || !batch.validationMetadata) return null;

  return {
    generation: batch.generationMetadata as unknown as ForecastBatch["generation"],
    products: batch.products.map(
      (product) => product.detailPayload as unknown as ProductForecastDetail
    ),
    source: batch.source,
    validation: batch.validationMetadata as unknown as ForecastBatch["validation"]
  };
}
