import type {
  HistoricalSalesPoint,
  ProductForecastDetail
} from "./forecast.types.js";
import { addMonths } from "./forecast-window.js";
import {
  loadReconstructedComparisonSales,
  type ReconstructedComparisonSales
} from "./historical-sales.service.js";

const WORKBOOK_PRODUCT_ID_PREFIX = "workbook:";
let reconstructedComparisonPromise: Promise<ReconstructedComparisonSales> | null = null;

function round4(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

function percentageChange(current: number, previous: number) {
  if (previous === 0) return null;
  return round4(((current - previous) / previous) * 100);
}

function sourceWorkbookProductId(productId: string) {
  return productId.startsWith(WORKBOOK_PRODUCT_ID_PREFIX)
    ? productId.slice(WORKBOOK_PRODUCT_ID_PREFIX.length)
    : null;
}

export function applyReconstructedComparisonOverlay(
  detail: ProductForecastDetail,
  comparisonByProductId: Map<string, HistoricalSalesPoint[]>
): ProductForecastDetail {
  const workbookProductId = sourceWorkbookProductId(detail.productId);
  if (!workbookProductId) return detail;

  const comparisonHistory = comparisonByProductId.get(workbookProductId);
  if (!comparisonHistory?.length) return detail;

  const byPeriod = new Map(comparisonHistory.map((point) => [point.period, point.quantitySold]));
  let changed = false;
  const forecast = detail.forecast.map((point) => {
    if (point.comparisonSalesQuantity !== null && point.comparisonSalesQuantity !== undefined) {
      return point;
    }

    const forecastMonth = point.period.slice(0, 7);
    const priorYearMonth = addMonths(forecastMonth, -12);
    const reconstructedQuantity = byPeriod.get(priorYearMonth);
    if (reconstructedQuantity === undefined) return point;

    changed = true;
    const variance = percentageChange(point.predictedQuantity, reconstructedQuantity);

    return {
      ...point,
      comparisonSalesEstimated: true,
      comparisonSalesQuantity: reconstructedQuantity,
      differenceVersus2025: round4(point.predictedQuantity - reconstructedQuantity),
      forecastVariancePercentage: variance,
      percentageChangeVersus2025: variance,
      sameMonthLastYear: reconstructedQuantity
    };
  });

  return changed ? { ...detail, forecast } : detail;
}

async function reconstructedComparisons() {
  reconstructedComparisonPromise ??= loadReconstructedComparisonSales().catch((error) => {
    reconstructedComparisonPromise = null;
    throw error;
  });
  return await reconstructedComparisonPromise;
}

export async function withReconstructedComparisonOverlay(
  detail: ProductForecastDetail | null
): Promise<ProductForecastDetail | null> {
  if (!detail || !sourceWorkbookProductId(detail.productId)) return detail;

  try {
    const reconstructed = await reconstructedComparisons();
    if (!reconstructed.available) return detail;

    return applyReconstructedComparisonOverlay(detail, reconstructed.products);
  } catch (error) {
    console.warn(
      "[forecast] Reconstructed comparison overlay unavailable; serving forecast without it.",
      error
    );
    return detail;
  }
}
