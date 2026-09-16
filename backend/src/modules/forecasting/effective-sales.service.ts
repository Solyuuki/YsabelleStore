import { prisma } from "../../database/prismaClient.js";
import { operationalProductWhere } from "../../services/catalogQualityPolicy.js";
import type { HistoricalSalesPoint, ProductHistoricalSeries } from "./forecast.types.js";
import { getActiveForecastMonth } from "./forecast-window.js";
import {
  loadHistoricalSalesFallbackData,
  loadReconstructedComparisonSales
} from "./historical-sales.service.js";

export const SARIMA_MINIMUM_OBSERVATIONS = 24;
export const SARIMA_SEASONAL_PERIOD = 12;
export const ZERO_SHARE_QUALITY_LIMIT = 0.5;

export type EligibilityStatus =
  | "ELIGIBLE"
  | "LIMITED_HISTORY"
  | "INSUFFICIENT_HISTORY"
  | "DATA_QUALITY_ISSUE";

export type EffectiveSalesPoint = {
  period: string;
  quantitySold: number;
  source: "POS_ACTUAL" | "IMPORTED_HISTORICAL";
};

export type ProductEligibility = {
  productId: string;
  productName: string;
  observationCount: number;
  missingMonths: string[];
  duplicateMonths: string[];
  zeroMonths: number;
  constantSeries: boolean;
  status: EligibilityStatus;
  reason: string;
};

export type EffectiveProductSeries = {
  category: string;
  productId: string;
  productName: string;
  sellingPrice: number;
  points: EffectiveSalesPoint[];
  eligibility: ProductEligibility;
  sourceProductIds?: string[];
};

type ImportedPointInput = {
  isActive: boolean;
  period: Date;
  productId: string;
  quantitySold: number;
  source: "IMPORTED_HISTORICAL" | "POS_ACTUAL" | "DEVELOPMENT_FIXTURE";
};

type ActualPointInput = {
  period: Date;
  productId: string;
  quantity: number;
};

function periodKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function missingPeriods(points: EffectiveSalesPoint[]) {
  if (points.length < 2) {
    return [];
  }

  const first = points[0];
  const last = points.at(-1);

  if (!first || !last) {
    return [];
  }

  const present = new Set(points.map((point) => point.period));
  const [startYear = 0, startMonth = 1] = first.period.split("-").map(Number);
  const [endYear = 0, endMonth = 1] = last.period.split("-").map(Number);
  const cursor = new Date(Date.UTC(startYear, startMonth - 1, 1));
  const end = new Date(Date.UTC(endYear, endMonth - 1, 1));
  const missing: string[] = [];

  while (cursor <= end) {
    const key = periodKey(cursor);

    if (!present.has(key)) {
      missing.push(key);
    }

    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return missing;
}

export function completedEffectiveSalesPoints(
  points: EffectiveSalesPoint[],
  activeForecastMonth = getActiveForecastMonth()
) {
  return points.filter((point) => point.period < activeForecastMonth);
}

export function assessSarimaEligibility(
  productId: string,
  productName: string,
  points: EffectiveSalesPoint[]
): ProductEligibility {
  const missingMonths = missingPeriods(points);
  const seenPeriods = new Set<string>();
  const duplicateMonths = [
    ...new Set(
      points.flatMap((point) => {
        if (seenPeriods.has(point.period)) {
          return [point.period];
        }

        seenPeriods.add(point.period);
        return [];
      })
    )
  ];
  const zeroMonths = points.filter((point) => point.quantitySold === 0).length;
  const constantSeries =
    points.length > 1 && points.every((point) => point.quantitySold === points[0]?.quantitySold);
  let status: EligibilityStatus;
  let reason: string;

  if (
    points.some((point) => !Number.isSafeInteger(point.quantitySold) || point.quantitySold < 0) ||
    missingMonths.length > 0 ||
    duplicateMonths.length > 0 ||
    constantSeries ||
    (points.length > 0 && zeroMonths / points.length > ZERO_SHARE_QUALITY_LIMIT)
  ) {
    status = "DATA_QUALITY_ISSUE";
    reason = missingMonths.length
      ? `${missingMonths.length} month(s) are missing between the first and last observation.`
      : duplicateMonths.length
        ? `${duplicateMonths.length} duplicate product-month observation(s) were found.`
        : constantSeries
          ? "The monthly series is constant and cannot support a reliable seasonal model."
          : "The monthly series contains invalid values or too many zero-sales months.";
  } else if (points.length >= SARIMA_MINIMUM_OBSERVATIONS) {
    status = "ELIGIBLE";
    reason = `At least ${SARIMA_MINIMUM_OBSERVATIONS} complete monthly observations are available.`;
  } else if (points.length >= SARIMA_SEASONAL_PERIOD) {
    status = "LIMITED_HISTORY";
    reason = `Only ${points.length} complete monthly observations are available; ${SARIMA_MINIMUM_OBSERVATIONS} are required for standard SARIMA.`;
  } else {
    status = "INSUFFICIENT_HISTORY";
    reason = `${points.length} monthly observation(s) are available; ${SARIMA_MINIMUM_OBSERVATIONS} are required for standard SARIMA.`;
  }

  return {
    constantSeries,
    duplicateMonths,
    missingMonths,
    observationCount: points.length,
    productId,
    productName,
    reason,
    status,
    zeroMonths
  };
}

export function combineEffectiveMonthlyPoints(
  imported: ImportedPointInput[],
  actualItems: ActualPointInput[]
) {
  const pointsByProduct = new Map<string, Map<string, EffectiveSalesPoint>>();

  for (const record of imported) {
    if (!record.isActive || record.source !== "IMPORTED_HISTORICAL") continue;
    const productPoints = pointsByProduct.get(record.productId) ?? new Map();
    const period = periodKey(record.period);
    const existing = productPoints.get(period);
    productPoints.set(period, {
      period,
      quantitySold:
        existing?.source === "IMPORTED_HISTORICAL"
          ? existing.quantitySold + record.quantitySold
          : record.quantitySold,
      source: "IMPORTED_HISTORICAL"
    });
    pointsByProduct.set(record.productId, productPoints);
  }

  // Completed POS sales are authoritative for a product-month and replace, rather than add to,
  // an imported complete-month observation.
  for (const item of actualItems) {
    const productPoints = pointsByProduct.get(item.productId) ?? new Map();
    const period = periodKey(item.period);
    const existing = productPoints.get(period);
    const actualQuantity = existing?.source === "POS_ACTUAL" ? existing.quantitySold : 0;
    productPoints.set(period, {
      period,
      quantitySold: actualQuantity + item.quantity,
      source: "POS_ACTUAL"
    });
    pointsByProduct.set(item.productId, productPoints);
  }

  return pointsByProduct;
}

function usableDatabaseSeries(product: EffectiveProductSeries) {
  return product.points.length > 0 && product.eligibility.status !== "DATA_QUALITY_ISSUE";
}

function identityKey(productName: string, category: string) {
  return `${productName.trim().toLowerCase()}\u0000${category.trim().toLowerCase()}`;
}

function remapHistoricalPoints(
  points: HistoricalSalesPoint[],
  target: EffectiveProductSeries
): HistoricalSalesPoint[] {
  return points.map((point) => ({
    ...point,
    category: target.category,
    productId: target.productId,
    productName: target.productName,
    sellingPrice: target.sellingPrice
  }));
}

function fallbackCandidateFor(
  target: EffectiveProductSeries,
  workbookById: Map<string, ProductHistoricalSeries>,
  workbookByIdentity: Map<string, ProductHistoricalSeries>
) {
  for (const sourceProductId of [...(target.sourceProductIds ?? []), target.productId]) {
    const direct = workbookById.get(sourceProductId);
    if (direct) return direct;
  }

  return workbookByIdentity.get(identityKey(target.productName, target.category));
}

export function mergeDatabaseProductsWithWorkbookFallback(
  series: EffectiveProductSeries[],
  databaseProducts: ProductHistoricalSeries[],
  workbookProducts: ProductHistoricalSeries[],
  reconstructedComparison = new Map<string, HistoricalSalesPoint[]>()
) {
  if (databaseProducts.length === 0) return databaseProducts;

  const usableIds = new Set(databaseProducts.map((product) => product.productId));
  const workbookById = new Map(workbookProducts.map((product) => [product.productId, product]));
  const workbookByIdentity = new Map(
    workbookProducts.map((product) => [identityKey(product.productName, product.category), product])
  );
  const merged = [...databaseProducts];

  for (const target of series) {
    if (usableIds.has(target.productId)) continue;

    const fallback = fallbackCandidateFor(target, workbookById, workbookByIdentity);
    if (!fallback) continue;

    const fallbackEligibility = assessSarimaEligibility(
      fallback.productId,
      fallback.productName,
      fallback.historical.map((point) => ({
        period: point.period,
        quantitySold: point.quantitySold,
        source: "IMPORTED_HISTORICAL" as const
      }))
    );
    if (fallbackEligibility.status !== "ELIGIBLE") continue;

    const comparison = reconstructedComparison.get(fallback.productId);
    merged.push({
      category: target.category,
      comparisonHistorical: comparison?.length
        ? remapHistoricalPoints(comparison, target)
        : undefined,
      historical: remapHistoricalPoints(fallback.historical, target),
      productId: target.productId,
      productName: target.productName,
      sellingPrice: target.sellingPrice
    });
    usableIds.add(target.productId);
  }

  return merged;
}

export async function getEffectiveMonthlySeries(productIds?: string[]) {
  const productWhere = operationalProductWhere(
    productIds?.length ? { id: { in: productIds } } : {}
  );
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    select: {
      category: { select: { name: true } },
      id: true,
      name: true,
      sellingPrice: true
    },
    where: productWhere
  });

  if (products.length === 0) {
    return [];
  }

  const ids = products.map((product) => product.id);
  const mappings = await prisma.productCanonicalMapping.findMany({
    select: { canonicalProductId: true, sourceProductId: true },
    where: { canonicalProductId: { in: ids } }
  });
  const sourceToCanonical = new Map(
    mappings.map((mapping) => [mapping.sourceProductId, mapping.canonicalProductId])
  );
  const sourceIdsByCanonical = new Map<string, string[]>();
  for (const mapping of mappings) {
    const sourceIds = sourceIdsByCanonical.get(mapping.canonicalProductId) ?? [];
    sourceIds.push(mapping.sourceProductId);
    sourceIdsByCanonical.set(mapping.canonicalProductId, sourceIds);
  }
  const sourceIds = mappings.map((mapping) => mapping.sourceProductId);
  const historicalProductIds = [...new Set([...ids, ...sourceIds])];
  const [imported, actualItems] = await Promise.all([
    prisma.historicalMonthlySales.findMany({
      orderBy: { period: "asc" },
      select: { isActive: true, period: true, productId: true, quantitySold: true, source: true },
      where: {
        isActive: true,
        productId: { in: historicalProductIds },
        source: "IMPORTED_HISTORICAL"
      }
    }),
    prisma.saleItem.findMany({
      select: {
        productId: true,
        quantity: true,
        sale: { select: { saleDate: true } }
      },
      where: {
        productId: { in: historicalProductIds },
        sale: { status: "COMPLETED" }
      }
    })
  ]);

  const pointsByProduct = combineEffectiveMonthlyPoints(
    imported.map((record) => ({
      ...record,
      productId: sourceToCanonical.get(record.productId) ?? record.productId
    })),
    actualItems.map((item) => ({
      period: item.sale.saleDate,
      productId: sourceToCanonical.get(item.productId) ?? item.productId,
      quantity: item.quantity
    }))
  );
  const activeForecastMonth = getActiveForecastMonth();

  return products.map((product): EffectiveProductSeries => {
    const points = completedEffectiveSalesPoints(
      [...(pointsByProduct.get(product.id)?.values() ?? [])].sort((left, right) =>
        left.period.localeCompare(right.period)
      ),
      activeForecastMonth
    );

    return {
      category: product.category.name,
      eligibility: assessSarimaEligibility(product.id, product.name, points),
      points,
      productId: product.id,
      productName: product.name,
      sellingPrice: Number(product.sellingPrice),
      sourceProductIds: sourceIdsByCanonical.get(product.id) ?? []
    };
  });
}

export async function loadEligibleEffectiveSales(productIds?: string[]) {
  const series = await getEffectiveMonthlySeries(productIds);
  const databaseProducts: ProductHistoricalSeries[] = series
    // Database history is primary whenever it is usable. SARIMA eligibility only decides which
    // model runs; short clean histories stay in DATABASE and use a fallback model.
    .filter(usableDatabaseSeries)
    .map((product) => ({
      category: product.category,
      historical: product.points.map((point) => ({
        category: product.category,
        period: point.period,
        productId: product.productId,
        productName: product.productName,
        quantitySold: point.quantitySold,
        sellingPrice: product.sellingPrice
      })),
      productId: product.productId,
      productName: product.productName,
      sellingPrice: product.sellingPrice
    }));

  if (databaseProducts.length === 0 || databaseProducts.length === series.length) {
    return { products: databaseProducts, series };
  }

  // Once at least one canonical database product is forecastable, preserve canonical identities
  // for the whole batch. Products that still lack usable database history may borrow the approved
  // workbook series per product instead of forcing the entire batch into WORKBOOK_FALLBACK.
  const [workbookFallback, reconstructed] = await Promise.all([
    loadHistoricalSalesFallbackData(),
    loadReconstructedComparisonSales()
  ]);
  if (!workbookFallback.available || !workbookFallback.data.validation.valid) {
    return { products: databaseProducts, series };
  }

  const products = mergeDatabaseProductsWithWorkbookFallback(
    series,
    databaseProducts,
    workbookFallback.data.products,
    reconstructed.available ? reconstructed.products : new Map()
  );

  return { products, series };
}
