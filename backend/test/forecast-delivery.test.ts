import assert from "node:assert/strict";
import test from "node:test";

import { summarizePersistedProduct } from "../src/modules/forecasting/forecast-persistence.service.js";
import { normalizeForecastPeriodMonth } from "../src/modules/forecasting/forecast-window.js";
import {
  forecastDetailQuerySchema,
  forecastListQuerySchema
} from "../src/modules/forecasting/forecast.schemas.js";
import { sourceVersionFor } from "../src/modules/forecasting/forecast-source-version.service.js";
import type { ProductForecastDetail } from "../src/modules/forecasting/forecast.types.js";

const sourceSnapshot = {
  activeForecastMonth: "2026-07-01",
  databaseRevision: "database-a",
  workbookRevision: "workbook-a"
};

function detail(productId = "workbook:P001"): ProductForecastDetail {
  return {
    category: "Beverages",
    error: null,
    forecast: Array.from({ length: 12 }, (_, index) => ({
      comparisonSalesQuantity: null,
      differenceVersus2025: null,
      forecastVariancePercentage: index === 0 ? 10 : null,
      lowerConfidence: index,
      percentageChangeVersus2025: null,
      period: `2026-${String(index + 1).padStart(2, "0")}`,
      predictedQuantity: index + 2,
      recommendedQuantity: index + 2,
      sameMonthLastYear: null,
      upperConfidence: index + 3
    })),
    generatedAt: "2026-07-15T12:00:00.000Z",
    historical: Array.from({ length: 24 }, (_, index) => ({
      category: "Beverages",
      period: `${index < 12 ? 2024 : 2025}-${String((index % 12) + 1).padStart(2, "0")}`,
      productId,
      productName: "Test Product",
      quantitySold: index + 1,
      sellingPrice: 25
    })),
    metrics: { mae: 1, mape: 2, rmse: 3, validationStrategy: "holdout", wape: 4 },
    model: "SARIMA",
    modelDetails: {
      aic: 1,
      converged: true,
      model: "SARIMA",
      order: [1, 0, 0],
      seasonalOrder: [1, 0, 0, 12]
    },
    productId,
    productName: "Test Product",
    sellingPrice: 25,
    status: "READY",
    warnings: []
  };
}

test("source version is deterministic for unchanged database input", () => {
  assert.equal(
    sourceVersionFor("DATABASE", sourceSnapshot),
    sourceVersionFor("DATABASE", { ...sourceSnapshot })
  );
});

test("database revision and forecast month invalidate database forecasts", () => {
  const current = sourceVersionFor("DATABASE", sourceSnapshot);
  assert.notEqual(
    current,
    sourceVersionFor("DATABASE", { ...sourceSnapshot, databaseRevision: "database-b" })
  );
  assert.notEqual(
    current,
    sourceVersionFor("DATABASE", { ...sourceSnapshot, activeForecastMonth: "2026-08-01" })
  );
});

test("workbook hashes invalidate fallback forecasts", () => {
  assert.notEqual(
    sourceVersionFor("WORKBOOK_FALLBACK", sourceSnapshot),
    sourceVersionFor("WORKBOOK_FALLBACK", {
      ...sourceSnapshot,
      workbookRevision: "workbook-b"
    })
  );
});

test("database and workbook sources never share a source version", () => {
  assert.notEqual(
    sourceVersionFor("DATABASE", sourceSnapshot),
    sourceVersionFor("WORKBOOK_FALLBACK", sourceSnapshot)
  );
});

test("persisted summary preserves workbook identity and exact aggregate fields", () => {
  const summary = summarizePersistedProduct(detail());
  assert.equal(summary.productId, "workbook:P001");
  assert.equal(summary.forecastHorizonMonths, 12);
  assert.equal(summary.forecastHorizonTotal, 90);
  assert.equal(summary.comparisonPeriodTotal, null);
  assert.equal(summary.growthVersusComparisonPeriod, null);
  assert.equal(summary.currentMonthForecastQuantity, 2);
  assert.equal(summary.forecastVariancePercentage, 10);
});

test("collection query normalizes safe defaults", () => {
  assert.deepEqual(forecastListQuerySchema.parse({}), {
    page: 1,
    pageSize: 20,
    sortBy: "productId",
    sortDirection: "asc"
  });
});

test("collection query accepts generic horizon demand sorting", () => {
  const query = forecastListQuerySchema.parse({
    page: "2",
    pageSize: "10",
    sortBy: "forecastHorizonTotal",
    sortDirection: "desc"
  });
  assert.equal(query.page, 2);
  assert.equal(query.sortBy, "forecastHorizonTotal");

  // Legacy aliases remain accepted for older clients.
  assert.equal(
    forecastListQuerySchema.parse({ sortBy: "twelveMonthForecastTotal" }).sortBy,
    "twelveMonthForecastTotal"
  );
});

test("collection query rejects oversized pages and unknown sort fields", () => {
  assert.equal(forecastListQuerySchema.safeParse({ pageSize: 101 }).success, false);
  assert.equal(forecastListQuerySchema.safeParse({ sortBy: "rawSql" }).success, false);
});

test("detail batch identity accepts workbook-safe request values", () => {
  assert.deepEqual(forecastDetailQuerySchema.parse({ batchId: "batch-1" }), {
    batchId: "batch-1"
  });
});

test("detail batch identity rejects unbounded input", () => {
  assert.equal(forecastDetailQuerySchema.safeParse({ batchId: "x".repeat(192) }).success, false);
});

test("forecast period normalization accepts Python month-start dates", () => {
  assert.equal(normalizeForecastPeriodMonth("2026-10"), "2026-10");
  assert.equal(normalizeForecastPeriodMonth("2026-10-01"), "2026-10");
  assert.equal(normalizeForecastPeriodMonth("2026-10-01T00:00:00.000Z"), "2026-10");
  assert.equal(normalizeForecastPeriodMonth("invalid"), null);
});
