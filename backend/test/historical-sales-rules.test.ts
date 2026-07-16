import assert from "node:assert/strict";
import test from "node:test";

import {
  assessSarimaEligibility,
  combineEffectiveMonthlyPoints,
  type EffectiveSalesPoint
} from "../src/modules/forecasting/effective-sales.service.js";
import { buildForecastProductList } from "../src/modules/forecasting/forecast.service.js";
import type { ForecastBatch } from "../src/modules/forecasting/forecast.types.js";
import {
  ACTIVE_HISTORICAL_SALES_DUPLICATE_STATUSES,
  assertHistoricalSalesPreviewConfirmable,
  expireAbandonedHistoricalSalesPreviews,
  hashHistoricalSalesFile,
  HISTORICAL_SALES_PREVIEW_EXPIRATION_MS,
  HISTORICAL_SALES_PREVIEW_EXPIRED_MESSAGE,
  isHistoricalSalesPreviewExpired,
  normalizeHistoricalSalesPeriod
} from "../src/services/historicalSalesImportService.js";
import { HttpError } from "../src/utils/httpError.js";
import { normalizeWhitespace } from "../src/utils/normalizers.js";

function points(count: number, value = (index: number) => index + 1): EffectiveSalesPoint[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(2022, index, 1));
    return {
      period: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`,
      quantitySold: value(index),
      source: "IMPORTED_HISTORICAL"
    };
  });
}

test("normalizes YYYY-MM to the first day of the month", () => {
  assert.equal(
    normalizeHistoricalSalesPeriod("2024-02")?.date.toISOString(),
    "2024-02-01T00:00:00.000Z"
  );
});

test("rejects a non-first-day monthly period", () => {
  assert.equal(normalizeHistoricalSalesPeriod("2024-02-15"), null);
});

test("preserves leading-zero barcode text", () => {
  assert.equal(normalizeWhitespace(" 0001234567890 "), "0001234567890");
});

test("stable SHA-256 file hash changes only with content", () => {
  assert.equal(
    hashHistoricalSalesFile(Buffer.from("same")),
    hashHistoricalSalesFile(Buffer.from("same"))
  );
  assert.notEqual(
    hashHistoricalSalesFile(Buffer.from("same")),
    hashHistoricalSalesFile(Buffer.from("different"))
  );
});

test("24 complete varying months are SARIMA eligible", () => {
  assert.equal(assessSarimaEligibility("p1", "Product", points(24)).status, "ELIGIBLE");
});

test("12 to 23 months are limited history", () => {
  assert.equal(assessSarimaEligibility("p1", "Product", points(23)).status, "LIMITED_HISTORY");
});

test("fewer than 12 months are insufficient history", () => {
  assert.equal(assessSarimaEligibility("p1", "Product", points(11)).status, "INSUFFICIENT_HISTORY");
});

test("missing sequential months are a data quality issue", () => {
  const series = points(24);
  series.splice(10, 1);
  assert.equal(assessSarimaEligibility("p1", "Product", series).status, "DATA_QUALITY_ISSUE");
});

test("duplicate product-month observations are a data quality issue", () => {
  const series = points(24);
  series.push({ ...series[0]! });
  assert.equal(assessSarimaEligibility("p1", "Product", series).status, "DATA_QUALITY_ISSUE");
});

test("constant monthly values are a data quality issue", () => {
  assert.equal(
    assessSarimaEligibility(
      "p1",
      "Product",
      points(24, () => 5)
    ).status,
    "DATA_QUALITY_ISSUE"
  );
});

test("more than half zero-sales months are a data quality issue", () => {
  assert.equal(
    assessSarimaEligibility(
      "p1",
      "Product",
      points(24, (index) => (index < 13 ? 0 : index))
    ).status,
    "DATA_QUALITY_ISSUE"
  );
});

test("POS actual replaces rather than adds to imported product-month quantity", () => {
  const combined = combineEffectiveMonthlyPoints(
    [
      {
        isActive: true,
        period: new Date("2024-01-01T00:00:00.000Z"),
        productId: "p1",
        quantitySold: 100,
        source: "IMPORTED_HISTORICAL"
      }
    ],
    [
      { period: new Date("2024-01-15T00:00:00.000Z"), productId: "p1", quantity: 3 },
      { period: new Date("2024-01-20T00:00:00.000Z"), productId: "p1", quantity: 2 }
    ]
  );
  assert.deepEqual(combined.get("p1")?.get("2024-01"), {
    period: "2024-01",
    quantitySold: 5,
    source: "POS_ACTUAL"
  });
});

test("inactive imports and development fixtures are excluded", () => {
  const combined = combineEffectiveMonthlyPoints(
    [
      {
        isActive: false,
        period: new Date("2024-01-01T00:00:00.000Z"),
        productId: "p1",
        quantitySold: 10,
        source: "IMPORTED_HISTORICAL"
      },
      {
        isActive: true,
        period: new Date("2024-02-01T00:00:00.000Z"),
        productId: "p1",
        quantitySold: 20,
        source: "DEVELOPMENT_FIXTURE"
      }
    ],
    []
  );
  assert.equal(combined.size, 0);
});

test("a fresh PREVIEWED batch passes the confirmation lifecycle guard", () => {
  const now = new Date("2026-07-15T12:00:00.000Z");
  const batch = {
    createdAt: new Date(now.getTime() - HISTORICAL_SALES_PREVIEW_EXPIRATION_MS + 1),
    errorMessage: null,
    importedByUserId: "owner-1",
    status: "PREVIEWED"
  };

  assert.equal(isHistoricalSalesPreviewExpired(batch.createdAt, now), false);
  assert.doesNotThrow(() => assertHistoricalSalesPreviewConfirmable(batch, "owner-1", now));
});

test("an expired PREVIEWED batch cannot be confirmed and requests a new preview", () => {
  const now = new Date("2026-07-15T12:00:00.000Z");
  const batch = {
    createdAt: new Date(now.getTime() - HISTORICAL_SALES_PREVIEW_EXPIRATION_MS),
    errorMessage: null,
    importedByUserId: "owner-1",
    status: "PREVIEWED"
  };

  assert.throws(
    () => assertHistoricalSalesPreviewConfirmable(batch, "owner-1", now),
    (error) =>
      error instanceof HttpError &&
      error.code === "EXPIRED_HISTORICAL_SALES_PREVIEW" &&
      error.message === HISTORICAL_SALES_PREVIEW_EXPIRED_MESSAGE
  );
});

test("a preview cannot be confirmed by another user", () => {
  const now = new Date("2026-07-15T12:00:00.000Z");
  const batch = {
    createdAt: now,
    errorMessage: null,
    importedByUserId: "owner-1",
    status: "PREVIEWED"
  };

  assert.throws(
    () => assertHistoricalSalesPreviewConfirmable(batch, "owner-2", now),
    (error) => error instanceof HttpError && error.code === "STALE_HISTORICAL_SALES_PREVIEW"
  );
});

test("lazy preview expiration marks only old PREVIEWED batches failed without deleting audits", async () => {
  const now = new Date("2026-07-15T12:00:00.000Z");
  let receivedArgs: unknown;
  const result = await expireAbandonedHistoricalSalesPreviews(now, {
    historicalSalesImportBatch: {
      async updateMany(args) {
        receivedArgs = args;
        return { count: 2 };
      }
    }
  });

  assert.equal(result.count, 2);
  assert.deepEqual(receivedArgs, {
    data: {
      errorMessage: HISTORICAL_SALES_PREVIEW_EXPIRED_MESSAGE,
      failedAt: now,
      status: "FAILED"
    },
    where: {
      createdAt: { lte: new Date(now.getTime() - HISTORICAL_SALES_PREVIEW_EXPIRATION_MS) },
      status: "PREVIEWED"
    }
  });
});

test("only active completed batches participate in duplicate-file blocking", () => {
  assert.deepEqual(ACTIVE_HISTORICAL_SALES_DUPLICATE_STATUSES, [
    "COMPLETED",
    "COMPLETED_WITH_SKIPS"
  ]);
  assert.equal(ACTIVE_HISTORICAL_SALES_DUPLICATE_STATUSES.includes("PREVIEWED" as never), false);
  assert.equal(ACTIVE_HISTORICAL_SALES_DUPLICATE_STATUSES.includes("FAILED" as never), false);
});

test("an empty eligible set produces a valid empty forecast collection", () => {
  const batch: ForecastBatch = {
    generation: {
      durationMs: 0,
      failedProducts: 0,
      firstForecastMonth: null,
      forecastPointsGenerated: 0,
      forecastStartMonth: "2026-07-01",
      generatedAt: "2026-07-15T12:00:00.000Z",
      infinityCount: 0,
      lastForecastMonth: null,
      movingAverageProducts: 0,
      nanCount: 0,
      negativeOperationalQuantityCount: 0,
      sarimaProducts: 0,
      seasonalNaiveProducts: 0,
      totalProductsProcessed: 0,
      validation: {
        errors: [],
        importedObservations: 0,
        importedProducts: 0,
        skippedProducts: 3,
        valid: true,
        warnings: []
      },
      warningProducts: 0
    },
    products: [],
    source: "EMPTY",
    validation: {
      errors: [],
      importedObservations: 0,
      importedProducts: 0,
      skippedProducts: 3,
      valid: true,
      warnings: []
    }
  };

  assert.deepEqual(
    buildForecastProductList(batch, {
      page: 1,
      pageSize: 1000,
      sortBy: "productName",
      sortDirection: "asc"
    }),
    {
      categories: [],
      generatedAt: "2026-07-15T12:00:00.000Z",
      items: [],
      page: 1,
      pageSize: 1000,
      totalItems: 0,
      totalPages: 1
    }
  );
});
