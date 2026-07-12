import type {
  ForecastBatch,
  ForecastFilters,
  ForecastGenerationSummary,
  ForecastModel,
  ForecastPoint,
  ForecastProductSummary,
  ForecastSummary,
  ProductForecastDetail
} from "./forecast.types.js";
import { getActiveForecastMonth, monthStartIso } from "./forecast-window.js";
import { loadHistoricalSalesData } from "./historical-sales.service.js";
import { runPythonForecast } from "./python-forecast-runner.service.js";
import { HttpError } from "../../utils/httpError.js";

let forecastCache: ForecastBatch | null = null;
let generationPromise: Promise<ForecastBatch> | null = null;

function sumForecast(points: ForecastPoint[]) {
  return points.reduce((sum, point) => sum + point.recommendedQuantity, 0);
}

function sumHistorical(product: ProductForecastDetail, year: number) {
  return product.historical
    .filter((point) => point.period.startsWith(`${year}-`))
    .reduce((sum, point) => sum + point.quantitySold, 0);
}

function sumRecentHistorical(product: ProductForecastDetail, months = 12) {
  return product.historical.slice(-months).reduce((sum, point) => sum + point.quantitySold, 0);
}

function percentageChange(current: number, previous: number) {
  if (previous === 0) {
    return null;
  }

  return ((current - previous) / previous) * 100;
}

function summarizeProduct(product: ProductForecastDetail): ForecastProductSummary {
  const totalHistorical2025 = sumHistorical(product, 2025);
  const totalForecast2026 = sumForecast(product.forecast);
  const currentForecastPoint = product.forecast[0];

  return {
    category: product.category,
    currentMonthForecastQuantity: currentForecastPoint?.recommendedQuantity ?? null,
    forecastVariancePercentage: currentForecastPoint?.forecastVariancePercentage ?? null,
    growthVersus2025: percentageChange(totalForecast2026, totalHistorical2025),
    productId: product.productId,
    productName: product.productName,
    recentHistoricalSalesTotal: sumRecentHistorical(product),
    twelveMonthForecastTotal: totalForecast2026,
    totalForecast2026,
    totalHistorical2024: sumHistorical(product, 2024),
    totalHistorical2025,
    warningCount: product.warnings.length
  };
}

function countByModel(products: ProductForecastDetail[], model: ForecastModel) {
  return products.filter((product) => product.model === model).length;
}

function countProblemValues(products: ProductForecastDetail[]) {
  let nanCount = 0;
  let infinityCount = 0;
  let negativeOperationalQuantityCount = 0;

  for (const product of products) {
    for (const point of product.forecast) {
      const values = [
        point.predictedQuantity,
        point.recommendedQuantity,
        point.lowerConfidence,
        point.upperConfidence
      ].filter((value): value is number => value !== null);

      for (const value of values) {
        if (Number.isNaN(value)) {
          nanCount += 1;
        }

        if (!Number.isFinite(value)) {
          infinityCount += 1;
        }
      }

      if (point.recommendedQuantity < 0) {
        negativeOperationalQuantityCount += 1;
      }
    }
  }

  return {
    infinityCount,
    nanCount,
    negativeOperationalQuantityCount
  };
}

function buildGenerationSummary(
  products: ProductForecastDetail[],
  durationMs: number,
  generatedAt: string,
  forecastStartMonth: string,
  validation: ForecastBatch["validation"]
): ForecastGenerationSummary {
  const problemCounts = countProblemValues(products);
  const forecastPeriods = products.flatMap((product) =>
    product.forecast.map((point) => point.period)
  );
  const sortedForecastPeriods = [...forecastPeriods].sort();

  return {
    durationMs,
    failedProducts: products.filter((product) => product.status === "FAILED").length,
    firstForecastMonth: sortedForecastPeriods[0] ?? null,
    forecastStartMonth: monthStartIso(forecastStartMonth),
    forecastPointsGenerated: forecastPeriods.length,
    generatedAt,
    lastForecastMonth: sortedForecastPeriods.at(-1) ?? null,
    movingAverageProducts: countByModel(products, "MOVING_AVERAGE"),
    sarimaProducts: countByModel(products, "SARIMA"),
    seasonalNaiveProducts: countByModel(products, "SEASONAL_NAIVE"),
    totalProductsProcessed: products.length,
    validation,
    warningProducts: products.filter((product) => product.warnings.length > 0).length,
    ...problemCounts
  };
}

export async function generateForecastBatch(options: { force?: boolean } = {}) {
  const activeForecastMonth = getActiveForecastMonth();
  const activeForecastStart = monthStartIso(activeForecastMonth);

  if (
    forecastCache &&
    !options.force &&
    forecastCache.generation.forecastStartMonth === activeForecastStart
  ) {
    return forecastCache;
  }

  if (generationPromise) {
    return await generationPromise;
  }

  generationPromise = (async () => {
    const startedAt = Date.now();
    const historicalImport = await loadHistoricalSalesData();

    if (!historicalImport.validation.valid) {
      throw new HttpError(422, "Historical sales data is invalid.", {
        code: "HISTORICAL_SALES_INVALID",
        details: historicalImport.validation
      });
    }

    const generatedAt = new Date().toISOString();
    const pythonResponse = await runPythonForecast(historicalImport.products);
    const durationMs = Date.now() - startedAt;
    const generation = buildGenerationSummary(
      pythonResponse.products,
      durationMs,
      generatedAt,
      activeForecastMonth,
      historicalImport.validation
    );

    forecastCache = {
      generation,
      products: pythonResponse.products,
      validation: historicalImport.validation
    };

    generationPromise = null;
    return forecastCache;
  })().catch((error) => {
    generationPromise = null;
    throw error;
  });

  return await generationPromise;
}

export async function validateHistoricalSales() {
  return await loadHistoricalSalesData();
}

export async function getForecastProductList(filters: ForecastFilters) {
  const batch = await generateForecastBatch();
  const categories = [...new Set(batch.products.map((product) => product.category))].sort();
  const summaries = batch.products.map(summarizeProduct);
  const search = filters.search?.toLowerCase();
  const filtered = summaries.filter((item) => {
    const matchesSearch = search
      ? `${item.productId} ${item.productName} ${item.category}`.toLowerCase().includes(search)
      : true;
    const matchesCategory = filters.category ? item.category === filters.category : true;

    return matchesSearch && matchesCategory;
  });

  filtered.sort((left, right) => {
    const leftValue = left[filters.sortBy];
    const rightValue = right[filters.sortBy];
    const direction = filters.sortDirection === "asc" ? 1 : -1;

    if (leftValue === null) {
      return 1;
    }

    if (rightValue === null) {
      return -1;
    }

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return (leftValue - rightValue) * direction;
    }

    return String(leftValue ?? "").localeCompare(String(rightValue ?? "")) * direction;
  });

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.pageSize;

  return {
    categories,
    generatedAt: batch.generation.generatedAt,
    items: filtered.slice(start, start + filters.pageSize),
    page,
    pageSize: filters.pageSize,
    totalItems,
    totalPages
  };
}

export async function getForecastProductDetail(productId: string) {
  const batch = await generateForecastBatch();
  const product = batch.products.find((item) => item.productId === productId);

  if (!product) {
    throw new HttpError(404, "Product forecast was not found.", {
      code: "FORECAST_PRODUCT_NOT_FOUND"
    });
  }

  return product;
}

export async function getForecastGenerationSummary() {
  const batch = await generateForecastBatch();

  return batch.generation;
}

export async function getForecastSummary(): Promise<ForecastSummary> {
  const batch = await generateForecastBatch();
  const summaries = batch.products.map(summarizeProduct);
  const actualUnits2024 = summaries.reduce((sum, item) => sum + item.totalHistorical2024, 0);
  const actualUnits2025 = summaries.reduce((sum, item) => sum + item.totalHistorical2025, 0);
  const forecastUnits2026 = summaries.reduce((sum, item) => sum + item.totalForecast2026, 0);
  const categories = new Map<string, ForecastSummary["categorySummaries"][number]>();

  for (const summary of summaries) {
    const current =
      categories.get(summary.category) ??
      ({
        actualUnits2024: 0,
        actualUnits2025: 0,
        category: summary.category,
        forecastUnits2026: 0
      } satisfies ForecastSummary["categorySummaries"][number]);

    current.actualUnits2024 += summary.totalHistorical2024;
    current.actualUnits2025 += summary.totalHistorical2025;
    current.forecastUnits2026 += summary.totalForecast2026;
    categories.set(summary.category, current);
  }

  return {
    actualUnits2024,
    actualUnits2025,
    categorySummaries: [...categories.values()].sort((left, right) =>
      left.category.localeCompare(right.category)
    ),
    failedProducts: batch.products.filter((item) => item.status === "FAILED").length,
    forecastGrowthVersus2025: percentageChange(forecastUnits2026, actualUnits2025),
    forecastUnits2026,
    generatedAt: batch.generation.generatedAt,
    highestGrowthProducts: [...summaries]
      .filter((item) => item.growthVersus2025 !== null)
      .sort((left, right) => (right.growthVersus2025 ?? 0) - (left.growthVersus2025 ?? 0))
      .slice(0, 8),
    monthlySummary: [
      ...Array.from({ length: 24 }, (_, index) => {
        const year = index < 12 ? 2024 : 2025;
        const month = (index % 12) + 1;
        const period = `${year}-${String(month).padStart(2, "0")}`;

        return {
          actualUnits: batch.products
            .flatMap((product) => product.historical)
            .filter((point) => point.period === period)
            .reduce((sum, point) => sum + point.quantitySold, 0),
          forecastUnits: null,
          period
        };
      }),
      ...Array.from({ length: 12 }, (_, index) => {
        const period = `2026-${String(index + 1).padStart(2, "0")}`;

        return {
          actualUnits: null,
          forecastUnits: batch.products
            .flatMap((product) => product.forecast)
            .filter((point) => point.period === period)
            .reduce((sum, point) => sum + point.recommendedQuantity, 0),
          period
        };
      })
    ],
    movingAverageProducts: countByModel(batch.products, "MOVING_AVERAGE"),
    sarimaProducts: countByModel(batch.products, "SARIMA"),
    seasonalNaiveProducts: countByModel(batch.products, "SEASONAL_NAIVE"),
    topForecastedProducts: [...summaries]
      .sort((left, right) => right.totalForecast2026 - left.totalForecast2026)
      .slice(0, 8),
    totalProductsForecasted: batch.products.filter((item) => item.status !== "FAILED").length,
    warningProducts: summaries.filter((item) => item.warningCount > 0).length
  };
}
