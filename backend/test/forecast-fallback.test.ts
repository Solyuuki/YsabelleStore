import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import type { EffectiveProductSeries } from "../src/modules/forecasting/effective-sales.service.js";
import { assessSarimaEligibility } from "../src/modules/forecasting/effective-sales.service.js";
import {
  buildForecastProductList,
  generateForecastBatch,
  getForecastProductDetail,
  invalidateForecastCache,
  loadForecastInput,
  WORKBOOK_PRODUCT_ID_PREFIX,
  type ForecastRuntimeDependencies
} from "../src/modules/forecasting/forecast.service.js";
import type {
  HistoricalImportValidation,
  ProductForecastDetail,
  ProductHistoricalSeries
} from "../src/modules/forecasting/forecast.types.js";
import {
  loadHistoricalSalesFallbackData,
  type HistoricalSalesFallbackResult,
  type HistoricalSalesImport
} from "../src/modules/forecasting/historical-sales.service.js";
import {
  getRepositoryRoot,
  resolveRepositoryPath
} from "../src/modules/forecasting/repository-paths.js";
import { runHistoricalSalesMutationWithForecastInvalidation } from "../src/services/historicalSalesImportService.js";
import { HttpError } from "../src/utils/httpError.js";

function historicalProduct(
  productId: string,
  quantity = (index: number) => index + 1
): ProductHistoricalSeries {
  const historical = Array.from({ length: 24 }, (_, index) => {
    const date = new Date(Date.UTC(2024, index, 1));
    return {
      category: "Test Category",
      period: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
      productId,
      productName: `Product ${productId}`,
      quantitySold: quantity(index),
      sellingPrice: 25
    };
  });

  return {
    category: "Test Category",
    historical,
    productId,
    productName: `Product ${productId}`,
    sellingPrice: 25
  };
}

function eligibleSeries(product: ProductHistoricalSeries): EffectiveProductSeries {
  const points = product.historical.map((point) => ({
    period: point.period,
    quantitySold: point.quantitySold,
    source: "IMPORTED_HISTORICAL" as const
  }));

  return {
    category: product.category,
    eligibility: assessSarimaEligibility(product.productId, product.productName, points),
    points,
    productId: product.productId,
    productName: product.productName,
    sellingPrice: product.sellingPrice
  };
}

function validation(products: ProductHistoricalSeries[]): HistoricalImportValidation {
  return {
    errors: [],
    importedObservations: products.reduce((sum, product) => sum + product.historical.length, 0),
    importedProducts: products.length,
    skippedProducts: 0,
    valid: true,
    warnings: []
  };
}

function workbookResult(products: ProductHistoricalSeries[]): HistoricalSalesFallbackResult {
  return {
    available: true,
    data: {
      products,
      validation: validation(products),
      workbookProductCounts: { products2024: products.length, products2025: products.length }
    }
  };
}

function forecastDetail(product: ProductHistoricalSeries): ProductForecastDetail {
  return {
    ...product,
    error: null,
    forecast: Array.from({ length: 12 }, (_, index) => ({
      comparisonSalesQuantity: null,
      differenceVersus2025: null,
      forecastVariancePercentage: null,
      lowerConfidence: index + 1,
      percentageChangeVersus2025: null,
      period: `2026-${String(index + 1).padStart(2, "0")}`,
      predictedQuantity: index + 2,
      recommendedQuantity: index + 2,
      sameMonthLastYear: null,
      upperConfidence: index + 3
    })),
    generatedAt: "2026-07-15T00:00:00.000Z",
    metrics: { mae: 1, mape: 1, rmse: 1, validationStrategy: "test", wape: 1 },
    model: "SARIMA",
    modelDetails: {
      aic: 1,
      converged: true,
      model: "SARIMA",
      order: [1, 0, 0],
      seasonalOrder: [1, 0, 0, 12]
    },
    status: "READY",
    warnings: []
  };
}

function runtimeDependencies(
  options: {
    databaseProducts?: ProductHistoricalSeries[];
    databaseSeries?: EffectiveProductSeries[];
    runForecast?: ForecastRuntimeDependencies["runForecast"];
    workbook?: HistoricalSalesFallbackResult;
    workbookRead?: () => void;
  } = {}
): ForecastRuntimeDependencies {
  const databaseProducts = options.databaseProducts ?? [];
  return {
    loadDatabaseInput: async () => ({
      products: databaseProducts,
      series: options.databaseSeries ?? databaseProducts.map(eligibleSeries)
    }),
    loadWorkbookInput: async () => {
      options.workbookRead?.();
      return options.workbook ?? { available: false, missingYears: [2024, 2025] };
    },
    runForecast:
      options.runForecast ??
      (async (products) => ({ products: products.map((product) => forecastDetail(product)) }))
  };
}

test("eligible database input has priority and does not read or merge workbooks", async () => {
  let workbookReads = 0;
  const databaseProduct = historicalProduct("db-product");
  const workbookProduct = historicalProduct("P001");
  const result = await loadForecastInput(
    undefined,
    runtimeDependencies({
      databaseProducts: [databaseProduct],
      workbook: workbookResult([workbookProduct]),
      workbookRead: () => {
        workbookReads += 1;
      }
    })
  );

  assert.equal(result.source, "DATABASE");
  assert.deepEqual(
    result.products.map((product) => product.productId),
    ["db-product"]
  );
  assert.equal(workbookReads, 0);
});

test("zero eligible database products selects eligible workbook input with stable identities", async () => {
  const result = await loadForecastInput(
    undefined,
    runtimeDependencies({ workbook: workbookResult([historicalProduct("P001")]) })
  );

  assert.equal(result.source, "WORKBOOK_FALLBACK");
  assert.equal(result.products.length, 1);
  assert.equal(result.products[0]?.productId, `${WORKBOOK_PRODUCT_ID_PREFIX}P001`);
  assert.ok(
    result.products[0]?.historical.every(
      (point) => point.productId === `${WORKBOOK_PRODUCT_ID_PREFIX}P001`
    )
  );
});

test("no eligible source returns EMPTY and does not invoke Python", async () => {
  let forecastRuns = 0;
  const constantWorkbookProduct = historicalProduct("P001", () => 5);
  const dependencies = runtimeDependencies({
    runForecast: async () => {
      forecastRuns += 1;
      return { products: [] };
    },
    workbook: workbookResult([constantWorkbookProduct])
  });

  invalidateForecastCache();
  const batch = await generateForecastBatch({ force: true }, dependencies);
  assert.equal(batch.source, "EMPTY");
  assert.deepEqual(batch.products, []);
  assert.equal(forecastRuns, 0);
});

test("workbook parser validation failure remains a controlled error", async () => {
  const invalidValidation = validation([]);
  invalidValidation.valid = false;
  invalidValidation.errors.push({
    code: "INVALID_MONTH_VALUE",
    message: "Month is invalid.",
    productId: "P001",
    row: 4,
    severity: "error",
    workbookYear: 2024
  });
  const invalidWorkbook: HistoricalSalesImport = {
    products: [],
    validation: invalidValidation,
    workbookProductCounts: { products2024: 0, products2025: 0 }
  };

  await assert.rejects(
    () =>
      loadForecastInput(
        undefined,
        runtimeDependencies({ workbook: { available: true, data: invalidWorkbook } })
      ),
    (error) => error instanceof HttpError && error.code === "HISTORICAL_SALES_INVALID"
  );
});

test("eligible workbook fallback invokes Python and supports list and detail lookup", async () => {
  let forecastRuns = 0;
  const dependencies = runtimeDependencies({
    runForecast: async (products) => {
      forecastRuns += 1;
      return { products: products.map(forecastDetail) };
    },
    workbook: workbookResult([historicalProduct("P001")])
  });

  invalidateForecastCache();
  const batch = await generateForecastBatch({ force: true }, dependencies);
  const productId = `${WORKBOOK_PRODUCT_ID_PREFIX}P001`;
  const list = buildForecastProductList(batch, {
    page: 1,
    pageSize: 20,
    sortBy: "productId",
    sortDirection: "asc"
  });
  const detail = await getForecastProductDetail(productId);

  assert.equal(forecastRuns, 1);
  assert.equal(batch.source, "WORKBOOK_FALLBACK");
  assert.equal(list.items[0]?.productId, productId);
  assert.equal(detail.productId, productId);
  assert.equal(detail.forecast.length, 12);
});

test("empty results are retried and explicit invalidation clears a populated cache", async () => {
  let available = false;
  let databaseReads = 0;
  const workbookProduct = historicalProduct("P001");
  const dependencies = runtimeDependencies({
    workbook: workbookResult([workbookProduct])
  });
  dependencies.loadDatabaseInput = async () => {
    databaseReads += 1;
    return { products: [], series: [] };
  };
  dependencies.loadWorkbookInput = async () =>
    available
      ? workbookResult([workbookProduct])
      : { available: false, missingYears: [2024, 2025] };

  invalidateForecastCache();
  assert.equal((await generateForecastBatch({}, dependencies)).source, "EMPTY");
  available = true;
  assert.equal((await generateForecastBatch({}, dependencies)).source, "WORKBOOK_FALLBACK");
  assert.equal(databaseReads, 2);

  invalidateForecastCache();
  await generateForecastBatch({}, dependencies);
  assert.equal(databaseReads, 3);
});

test("forced refresh bypasses cache and a failed refresh preserves the last successful batch", async () => {
  let fail = false;
  let forecastRuns = 0;
  const product = historicalProduct("db-product");
  const dependencies = runtimeDependencies({
    databaseProducts: [product],
    runForecast: async (products) => {
      forecastRuns += 1;
      if (fail) throw new Error("Synthetic Python failure");
      return { products: products.map(forecastDetail) };
    }
  });

  invalidateForecastCache();
  const successful = await generateForecastBatch({}, dependencies);
  assert.equal(
    (await generateForecastBatch({}, dependencies)).generation.generatedAt,
    successful.generation.generatedAt
  );
  assert.equal(forecastRuns, 1);

  fail = true;
  await assert.rejects(() => generateForecastBatch({ force: true }, dependencies));
  assert.equal(
    (await generateForecastBatch({}, dependencies)).products[0]?.productId,
    "db-product"
  );
  assert.equal(forecastRuns, 2);
});

test("historical mutation invalidates only after successful commit", async () => {
  let invalidations = 0;
  const success = await runHistoricalSalesMutationWithForecastInvalidation(
    async () => "committed",
    () => {
      invalidations += 1;
    }
  );
  assert.equal(success, "committed");
  assert.equal(invalidations, 1);

  await assert.rejects(() =>
    runHistoricalSalesMutationWithForecastInvalidation(
      async () => {
        throw new Error("rollback");
      },
      () => {
        invalidations += 1;
      }
    )
  );
  assert.equal(invalidations, 1);
});

test("approved workbooks resolve and provide 472 eligible paired products from root and backend", async () => {
  const originalDirectory = process.cwd();
  const repositoryRoot = getRepositoryRoot();

  try {
    for (const directory of [repositoryRoot, path.join(repositoryRoot, "backend")]) {
      process.chdir(directory);
      assert.ok(
        fs.existsSync(resolveRepositoryPath("data/forecasting/historical-sales-2024.xlsx"))
      );
      assert.ok(
        fs.existsSync(resolveRepositoryPath("data/forecasting/historical-sales-2025.xlsx"))
      );
      const fallback = await loadHistoricalSalesFallbackData();
      assert.equal(fallback.available, true);
      if (!fallback.available) continue;
      assert.equal(fallback.data.workbookProductCounts.products2024, 472);
      assert.equal(fallback.data.workbookProductCounts.products2025, 472);
      const input = await loadForecastInput(undefined, runtimeDependencies({ workbook: fallback }));
      assert.equal(input.source, "WORKBOOK_FALLBACK");
      assert.equal(input.products.length, 472);
      assert.ok(input.products.every((product) => product.historical.length === 24));
    }
  } finally {
    process.chdir(originalDirectory);
  }
});
