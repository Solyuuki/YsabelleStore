import type {
  ForecastProductSummary,
  ProductForecastDetail
} from "./forecast.types.js";

export function percentageChange(current: number, previous: number | null) {
  if (previous === null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function sumHistoricalYear(product: ProductForecastDetail, year: number) {
  return product.historical
    .filter((point) => point.period.startsWith(`${year}-`))
    .reduce((sum, point) => sum + point.quantitySold, 0);
}

export function historicalYearTotals(product: ProductForecastDetail) {
  const totals = new Map<number, number>();

  for (const point of product.historical) {
    const year = Number(point.period.slice(0, 4));
    if (!Number.isInteger(year)) continue;
    totals.set(year, (totals.get(year) ?? 0) + point.quantitySold);
  }

  return [...totals.entries()]
    .sort(([left], [right]) => left - right)
    .map(([year, units]) => ({ year, units }));
}

export function summarizeForecastProduct(
  product: ProductForecastDetail
): ForecastProductSummary {
  const current = product.forecast[0] ?? null;
  const forecastHorizonTotal = product.forecast.reduce(
    (sum, point) => sum + point.recommendedQuantity,
    0
  );
  const comparisonValues = product.forecast
    .map((point) => point.comparisonSalesQuantity)
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const comparisonPeriodTotal =
    comparisonValues.length === product.forecast.length && product.forecast.length > 0
      ? comparisonValues.reduce((sum, value) => sum + value, 0)
      : null;

  return {
    category: product.category,
    comparisonPeriodTotal,
    currentMonthForecastQuantity: current?.recommendedQuantity ?? null,
    forecastHorizonMonths: product.forecast.length,
    forecastHorizonTotal,
    forecastVariancePercentage: current?.forecastVariancePercentage ?? null,
    growthVersusComparisonPeriod: percentageChange(
      forecastHorizonTotal,
      comparisonPeriodTotal
    ),
    productId: product.productId,
    productName: product.productName,
    recentHistoricalSalesTotal: product.historical
      .slice(-12)
      .reduce((sum, point) => sum + point.quantitySold, 0),
    warningCount: product.warnings.length
  };
}
