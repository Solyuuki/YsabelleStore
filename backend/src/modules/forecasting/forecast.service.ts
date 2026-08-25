import type {
  ForecastBatch,
  ForecastFilters,
  ForecastGenerationSummary,
  ForecastInputSource,
  ForecastModel,
  ForecastPoint,
  ForecastProductSummary,
  ForecastSummary,
  HistoricalImportIssue,
  HistoricalImportValidation,
  ProductHistoricalSeries,
  ProductForecastDetail
} from "./forecast.types.js";
import type { ForecastDeliveryStatus, ForecastRefreshResponse } from "./forecast.types.js";
import { getActiveForecastMonth, monthStartIso } from "./forecast-window.js";
import {
  loadHistoricalSalesData,
  loadHistoricalSalesFallbackData,
  type HistoricalSalesFallbackResult
} from "./historical-sales.service.js";
import { runPythonForecast } from "./python-forecast-runner.service.js";
import { HttpError } from "../../utils/httpError.js";
import { assessSarimaEligibility, loadEligibleEffectiveSales } from "./effective-sales.service.js";
import {
  createGeneratingForecastBatch,
  failForecastBatch,
  getActivePersistedForecastBatch,
  getPersistedForecastDetail,
  loadPersistedForecastBatch,
  persistAndActivateForecastBatch,
  queryPersistedForecastProducts,
  recoverAbandonedForecastJobs
} from "./forecast-persistence.service.js";
import {
  getForecastSourceSnapshot,
  invalidateForecastSourceSnapshot,
  sourceVersionFor,
  type ForecastSourceSnapshot
} from "./forecast-source-version.service.js";

let forecastCache: ForecastBatch | null = null;
let generationPromise: Promise<ForecastBatch> | null = null;
let generationVersion: number | null = null;
let cacheVersion = 0;
let deliveryJob: Promise<void> | null = null;
let deliveryJobId: string | null = null;
let recoveryPromise: Promise<unknown> | null = null;
let lastDeliveryFailure: { key: string; occurredAt: string } | null = null;
let queuedFullRefresh = false;
const queuedAffectedProductIds = new Set<string>();

export const WORKBOOK_PRODUCT_ID_PREFIX = "workbook:";

export type ForecastInputResult = {
  allProducts: ProductHistoricalSeries[];
  products: ProductHistoricalSeries[];
  source: ForecastInputSource;
  validation: HistoricalImportValidation;
  warnings: HistoricalImportIssue[];
};

export type ForecastRuntimeDependencies = {
  loadDatabaseInput: typeof loadEligibleEffectiveSales;
  loadWorkbookInput: () => Promise<HistoricalSalesFallbackResult>;
  runForecast: typeof runPythonForecast;
};

const defaultDependencies: ForecastRuntimeDependencies = {
  loadDatabaseInput: loadEligibleEffectiveSales,
  loadWorkbookInput: loadHistoricalSalesFallbackData,
  runForecast: runPythonForecast
};

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

function databaseWarnings(
  effective: Awaited<ReturnType<typeof loadEligibleEffectiveSales>>
): HistoricalImportIssue[] {
  return effective.series
    .filter((product) => product.eligibility.status !== "ELIGIBLE")
    .map((product) => ({
      code: product.eligibility.status,
      message: product.eligibility.reason,
      productId: product.productId,
      row: null,
      severity: "warning" as const,
      workbookYear: null
    }));
}

function withWorkbookIdentity(product: ProductHistoricalSeries): ProductHistoricalSeries {
  const productId = `${WORKBOOK_PRODUCT_ID_PREFIX}${product.productId}`;

  return {
    ...product,
    historical: product.historical.map((point) => ({ ...point, productId })),
    productId
  };
}

function selectProducts(products: ProductHistoricalSeries[], productIds?: string[]) {
  if (!productIds?.length) {
    return products;
  }

  const selected = new Set(productIds);
  return products.filter((product) => selected.has(product.productId));
}

function emptyValidation(skippedProducts: number, warnings: HistoricalImportIssue[] = []) {
  return {
    errors: [],
    importedObservations: 0,
    importedProducts: 0,
    skippedProducts,
    valid: true,
    warnings
  } satisfies HistoricalImportValidation;
}

export async function loadForecastInput(
  productIds?: string[],
  dependencies: ForecastRuntimeDependencies = defaultDependencies
): Promise<ForecastInputResult> {
  // Source selection is global. Product IDs narrow a refresh only after DB priority is known.
  const effective = await dependencies.loadDatabaseInput();
  const dbWarnings = databaseWarnings(effective);

  if (effective.products.length > 0) {
    const validation = {
      errors: [],
      importedObservations: effective.products.reduce(
        (sum, product) => sum + product.historical.length,
        0
      ),
      importedProducts: effective.products.length,
      skippedProducts: effective.series.length - effective.products.length,
      valid: true,
      warnings: dbWarnings
    } satisfies HistoricalImportValidation;

    return {
      allProducts: effective.products,
      products: selectProducts(effective.products, productIds),
      source: "DATABASE",
      validation,
      warnings: dbWarnings
    };
  }

  const workbookFallback = await dependencies.loadWorkbookInput();

  if (!workbookFallback.available) {
    console.warn(
      `[forecast] Workbook fallback unavailable; approved workbook year(s) missing: ${workbookFallback.missingYears.join(", ")}.`
    );
    const validation = emptyValidation(effective.series.length, dbWarnings);

    return {
      allProducts: [],
      products: [],
      source: "EMPTY",
      validation,
      warnings: dbWarnings
    };
  }

  const workbookImport = workbookFallback.data;

  if (!workbookImport.validation.valid) {
    throw new HttpError(422, "Historical sales workbook data is invalid.", {
      code: "HISTORICAL_SALES_INVALID",
      details: workbookImport.validation
    });
  }

  const workbookEligibility = workbookImport.products.map((product) => ({
    eligibility: assessSarimaEligibility(
      product.productId,
      product.productName,
      product.historical.map((point) => ({
        period: point.period,
        quantitySold: point.quantitySold,
        source: "IMPORTED_HISTORICAL" as const
      }))
    ),
    product
  }));
  const workbookWarnings: HistoricalImportIssue[] = workbookEligibility
    .filter(({ eligibility }) => eligibility.status !== "ELIGIBLE")
    .map(({ eligibility }) => ({
      code: eligibility.status,
      message: eligibility.reason,
      productId: eligibility.productId,
      row: null,
      severity: "warning",
      workbookYear: null
    }));
  const eligibleWorkbookProducts = workbookEligibility
    .filter(({ eligibility }) => eligibility.status === "ELIGIBLE")
    .map(({ product }) => withWorkbookIdentity(product));
  const warnings = [...dbWarnings, ...workbookImport.validation.warnings, ...workbookWarnings];

  if (eligibleWorkbookProducts.length === 0) {
    const validation = emptyValidation(
      effective.series.length + workbookImport.products.length,
      warnings
    );

    return {
      allProducts: [],
      products: [],
      source: "EMPTY",
      validation,
      warnings
    };
  }

  const validation = {
    errors: [],
    importedObservations: eligibleWorkbookProducts.reduce(
      (sum, product) => sum + product.historical.length,
      0
    ),
    importedProducts: eligibleWorkbookProducts.length,
    skippedProducts:
      effective.series.length +
      workbookImport.validation.skippedProducts +
      workbookEligibility.length -
      eligibleWorkbookProducts.length,
    valid: true,
    warnings
  } satisfies HistoricalImportValidation;

  return {
    allProducts: eligibleWorkbookProducts,
    products: selectProducts(eligibleWorkbookProducts, productIds),
    source: "WORKBOOK_FALLBACK",
    validation,
    warnings
  };
}

async function generateBatchFromInput(
  forecastInput: ForecastInputResult,
  inputProducts: ProductHistoricalSeries[],
  dependencies: ForecastRuntimeDependencies,
  startedAt: number,
  existingProducts: ProductForecastDetail[] = [],
  replacedProductIds: string[] = []
) {
  const generatedAt = new Date().toISOString();
  const generatedProducts = inputProducts.length
    ? (await dependencies.runForecast(inputProducts)).products
    : [];

  if (generatedProducts.length !== inputProducts.length) {
    throw new Error(
      `Forecast output was incomplete: expected ${inputProducts.length} products, received ${generatedProducts.length}.`
    );
  }

  const outputIds = new Set(generatedProducts.map((product) => product.productId));
  if (outputIds.size !== generatedProducts.length) {
    throw new Error("Forecast output contains duplicate product identities.");
  }

  const replaced = new Set(replacedProductIds);
  const products = [
    ...existingProducts.filter((product) => !replaced.has(product.productId)),
    ...generatedProducts
  ].map((product) => ({ ...product, generatedAt }));
  const activeForecastMonth = getActiveForecastMonth();
  const generation = buildGenerationSummary(
    products,
    Date.now() - startedAt,
    generatedAt,
    activeForecastMonth,
    forecastInput.validation
  );

  return {
    generation,
    products,
    source: forecastInput.source,
    validation: forecastInput.validation
  } satisfies ForecastBatch;
}

export async function generateForecastBatch(
  options: { force?: boolean; productIds?: string[] } = {},
  dependencies: ForecastRuntimeDependencies = defaultDependencies
) {
  const activeForecastMonth = getActiveForecastMonth();
  const activeForecastStart = monthStartIso(activeForecastMonth);
  const targeted = Boolean(options.productIds?.length);

  if (
    forecastCache &&
    !options.force &&
    !targeted &&
    forecastCache.products.length > 0 &&
    forecastCache.generation.forecastStartMonth === activeForecastStart
  ) {
    return forecastCache;
  }

  if (generationPromise) {
    const activeVersion = generationVersion;
    const activeGeneration = await generationPromise;

    if (options.force || targeted || activeVersion !== cacheVersion) {
      return await generateForecastBatch(options, dependencies);
    }

    return activeGeneration;
  }

  const startedVersion = cacheVersion;
  generationVersion = startedVersion;
  const activePromise = (async () => {
    const startedAt = Date.now();
    const forecastInput = await loadForecastInput(options.productIds, dependencies);
    const canMergeTargetedRefresh =
      targeted &&
      forecastCache?.source === forecastInput.source &&
      forecastInput.source !== "EMPTY";
    const inputProducts = canMergeTargetedRefresh
      ? forecastInput.products
      : forecastInput.allProducts;

    const batch = await generateBatchFromInput(
      forecastInput,
      inputProducts,
      dependencies,
      startedAt,
      canMergeTargetedRefresh && forecastCache ? forecastCache.products : [],
      canMergeTargetedRefresh ? (options.productIds ?? []) : []
    );

    // An import or rollback may invalidate the cache while Python is still running.
    if (startedVersion === cacheVersion && batch.products.length > 0) {
      forecastCache = batch;
    }

    return batch;
  })();
  generationPromise = activePromise;

  try {
    return await activePromise;
  } finally {
    if (generationPromise === activePromise) {
      generationPromise = null;
      generationVersion = null;
    }
  }
}

export function invalidateForecastCache(productIds?: string[]) {
  cacheVersion += 1;
  forecastCache = null;
  invalidateForecastSourceSnapshot();

  if (productIds?.length && !process.env.NODE_TEST_CONTEXT) {
    void requestForecastRefresh({ productIds }).catch((error) => {
      console.error("[forecast] Unable to schedule the forecast refresh.", error);
    });
  }
}

function ensureForecastJobRecovery() {
  recoveryPromise ??= recoverAbandonedForecastJobs().catch((error) => {
    recoveryPromise = null;
    throw error;
  });
  return recoveryPromise;
}

function isPersistedBatchCurrent(
  batch: Awaited<ReturnType<typeof getActivePersistedForecastBatch>>,
  snapshot: ForecastSourceSnapshot
) {
  if (!batch) return false;
  return (
    batch.forecastStartMonth.toISOString().slice(0, 10) ===
      snapshot.activeForecastMonth.slice(0, 10) &&
    batch.sourceVersion === sourceVersionFor(batch.source, snapshot)
  );
}

function deliveryStatus(
  active: Awaited<ReturnType<typeof getActivePersistedForecastBatch>>,
  current: boolean
): ForecastDeliveryStatus {
  if (!active) {
    return deliveryJob ? "GENERATING" : lastDeliveryFailure ? "FAILED" : "GENERATING";
  }
  if (deliveryJob) {
    return active.source === "EMPTY" ? "GENERATING" : "REFRESHING";
  }
  if (active.source === "EMPTY" && current) return "EMPTY";
  if (current) return "READY";
  if (lastDeliveryFailure?.key === active.sourceVersion && !deliveryJob) {
    return "FAILED_WITH_PREVIOUS";
  }
  return deliveryJob ? "REFRESHING" : "STALE";
}

async function runPersistedForecastRefresh(options: { force: boolean; productIds?: string[] }) {
  const startedAt = Date.now();
  const snapshotBefore = await getForecastSourceSnapshot();
  const active = await getActivePersistedForecastBatch();
  const requestedIds = [...new Set(options.productIds ?? [])];
  const sameMonth =
    active?.forecastStartMonth.toISOString().slice(0, 10) ===
    snapshotBefore.activeForecastMonth.slice(0, 10);
  const incrementalRequested =
    requestedIds.length > 0 && active?.source === "DATABASE" && sameMonth;
  const input = await loadForecastInput(incrementalRequested ? requestedIds : undefined);
  const sourceVersion = sourceVersionFor(input.source, snapshotBefore);

  if (!options.force && requestedIds.length === 0 && active?.sourceVersion === sourceVersion) {
    return;
  }

  const job = await createGeneratingForecastBatch(input.source, sourceVersion, snapshotBefore);
  deliveryJobId = job.id;

  try {
    let existingProducts: ProductForecastDetail[] = [];
    let inputProducts = input.allProducts;
    let replacedProductIds: string[] = [];

    if (incrementalRequested && input.source === "DATABASE" && active) {
      const previousBatch = await loadPersistedForecastBatch(active.id);
      if (previousBatch?.source === "DATABASE") {
        const selectedEligibleIds = new Set(input.products.map((product) => product.productId));
        const expectedIds = new Set(input.allProducts.map((product) => product.productId));
        const mergedIds = new Set([
          ...previousBatch.products
            .filter((product) => !requestedIds.includes(product.productId))
            .map((product) => product.productId),
          ...selectedEligibleIds
        ]);
        const mergeIsComplete =
          expectedIds.size === mergedIds.size && [...expectedIds].every((id) => mergedIds.has(id));

        if (mergeIsComplete) {
          existingProducts = previousBatch.products;
          inputProducts = input.products;
          replacedProductIds = requestedIds;
        }
      }
    }

    const batch = await generateBatchFromInput(
      input,
      inputProducts,
      defaultDependencies,
      startedAt,
      existingProducts,
      replacedProductIds
    );
    const snapshotAfter = await getForecastSourceSnapshot();
    if (sourceVersionFor(input.source, snapshotAfter) !== sourceVersion) {
      queuedFullRefresh = true;
      throw new Error("Forecast source changed while generation was running.");
    }

    await persistAndActivateForecastBatch(job.id, batch);
    forecastCache = batch.products.length > 0 ? batch : null;
    lastDeliveryFailure = null;
  } catch (error) {
    await failForecastBatch(job.id);
    lastDeliveryFailure = {
      key: active?.sourceVersion ?? sourceVersion,
      occurredAt: new Date().toISOString()
    };
    throw error;
  }
}

export async function requestForecastRefresh(
  options: { force?: boolean; productIds?: string[] } = {}
): Promise<ForecastRefreshResponse> {
  await ensureForecastJobRecovery();
  const active = await getActivePersistedForecastBatch();

  if (deliveryJob) {
    for (const productId of options.productIds ?? []) {
      queuedAffectedProductIds.add(productId);
    }
    return {
      accepted: true,
      generationId: deliveryJobId,
      previousDataAvailable: Boolean(active && active.source !== "EMPTY"),
      status: active && active.source !== "EMPTY" ? "REFRESHING" : "GENERATING"
    };
  }

  const activePromise = runPersistedForecastRefresh({
    force: options.force ?? false,
    productIds: options.productIds
  });
  deliveryJob = activePromise;
  void activePromise
    .catch((error) => {
      console.error("[forecast] Background forecast refresh failed.", error);
    })
    .finally(() => {
      if (deliveryJob === activePromise) {
        deliveryJob = null;
        deliveryJobId = null;
        const productIds = queuedFullRefresh ? undefined : [...queuedAffectedProductIds];
        const runQueuedRefresh = queuedFullRefresh || Boolean(productIds?.length);
        queuedFullRefresh = false;
        queuedAffectedProductIds.clear();

        if (runQueuedRefresh) {
          void requestForecastRefresh({ productIds }).catch((error) => {
            console.error("[forecast] Queued forecast refresh failed.", error);
          });
        }
      }
    });

  return {
    accepted: true,
    generationId: deliveryJobId,
    previousDataAvailable: Boolean(active && active.source !== "EMPTY"),
    status: active && active.source !== "EMPTY" ? "REFRESHING" : "GENERATING"
  };
}

export async function waitForForecastRefresh(options: { force?: boolean } = {}) {
  await requestForecastRefresh(options);
  const activeJob = deliveryJob;
  if (activeJob) await activeJob;
  return await getActivePersistedForecastBatch();
}

async function getForecastDeliveryContext() {
  await ensureForecastJobRecovery();
  const [snapshot, active] = await Promise.all([
    getForecastSourceSnapshot(),
    getActivePersistedForecastBatch()
  ]);
  const current = isPersistedBatchCurrent(active, snapshot);

  const failedForCurrentData = active
    ? lastDeliveryFailure?.key === active.sourceVersion
    : Boolean(lastDeliveryFailure);

  if (!current && !deliveryJob && !failedForCurrentData) {
    void requestForecastRefresh().catch((error) => {
      console.error("[forecast] Unable to start stale forecast refresh.", error);
    });
  }

  return {
    active,
    current,
    status:
      !current && !failedForCurrentData
        ? active
          ? ("REFRESHING" as const)
          : ("GENERATING" as const)
        : deliveryStatus(active, current)
  };
}

export async function validateHistoricalSales() {
  return await loadHistoricalSalesData();
}

export function buildForecastProductList(batch: ForecastBatch, filters: ForecastFilters) {
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

export async function getForecastProductList(filters: ForecastFilters) {
  const context = await getForecastDeliveryContext();

  if (!context.active) {
    return {
      batchId: null,
      categories: [],
      forecastStartMonth: monthStartIso(getActiveForecastMonth()),
      generatedAt: null,
      isRefreshing: context.status === "GENERATING",
      isStale: false,
      items: [],
      page: 1,
      pageSize: filters.pageSize,
      status: context.status,
      totalItems: 0,
      totalPages: 1
    };
  }

  return await queryPersistedForecastProducts(context.active, filters, {
    batchId: context.active.id,
    forecastStartMonth: context.active.forecastStartMonth.toISOString().slice(0, 10),
    isRefreshing: context.status === "REFRESHING",
    isStale: !context.current,
    status: context.status
  });
}

export async function getForecastProductDetail(productId: string, requestedBatchId?: string) {
  if (!requestedBatchId) {
    const memoryProduct = forecastCache?.products.find((item) => item.productId === productId);
    if (memoryProduct) return memoryProduct;
  }

  const context = requestedBatchId ? null : await getForecastDeliveryContext();
  const batchId = requestedBatchId ?? context?.active?.id;
  const product = batchId ? await getPersistedForecastDetail(batchId, productId) : null;

  if (!product) {
    throw new HttpError(404, "Product forecast was not found.", {
      code: "FORECAST_PRODUCT_NOT_FOUND"
    });
  }

  return product;
}

export async function getForecastGenerationSummary() {
  const context = await getForecastDeliveryContext();
  const batch = context.active ? await loadPersistedForecastBatch(context.active.id) : null;

  if (!batch) {
    throw new HttpError(409, "Forecast generation is still in progress.", {
      code: "FORECAST_GENERATING"
    });
  }

  return batch.generation;
}

export async function getForecastSummary(): Promise<ForecastSummary> {
  const context = await getForecastDeliveryContext();
  const batch = context.active ? await loadPersistedForecastBatch(context.active.id) : null;

  if (!batch) {
    throw new HttpError(409, "Forecast generation is still in progress.", {
      code: "FORECAST_GENERATING"
    });
  }
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
