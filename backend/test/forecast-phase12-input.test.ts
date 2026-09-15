import assert from "node:assert/strict";
import test from "node:test";

import {
  assessSarimaEligibility,
  combineEffectiveMonthlyPoints,
  completedEffectiveSalesPoints
} from "../src/modules/forecasting/effective-sales.service.js";
import { sameForecastInput } from "../src/modules/forecasting/forecast.service.js";
import { completedHistoryCutoff } from "../src/modules/forecasting/forecast-source-version.service.js";
import type {
  ProductForecastDetail,
  ProductHistoricalSeries
} from "../src/modules/forecasting/forecast.types.js";
import { getDomainChangeEffects } from "../src/services/domainChangeService.js";

test("current partial month is excluded from monthly SARIMA training history", () => {
  const points = [
    { period: "2026-07", quantitySold: 10, source: "POS_ACTUAL" as const },
    { period: "2026-08", quantitySold: 12, source: "POS_ACTUAL" as const },
    { period: "2026-09", quantitySold: 4, source: "POS_ACTUAL" as const }
  ];

  assert.deepEqual(
    completedEffectiveSalesPoints(points, "2026-09").map((point) => point.period),
    ["2026-07", "2026-08"]
  );
});

test("forecast source version uses the active month boundary as completed-history cutoff", () => {
  assert.equal(completedHistoryCutoff("2026-09").toISOString(), "2026-09-01T00:00:00.000Z");
});

test("completed POS actuals replace imported values for the same product month", () => {
  const combined = combineEffectiveMonthlyPoints(
    [
      {
        isActive: true,
        period: new Date("2026-08-01T00:00:00.000Z"),
        productId: "P1",
        quantitySold: 99,
        source: "IMPORTED_HISTORICAL"
      }
    ],
    [
      { period: new Date("2026-08-10T00:00:00.000Z"), productId: "P1", quantity: 3 },
      { period: new Date("2026-08-20T00:00:00.000Z"), productId: "P1", quantity: 4 }
    ]
  );

  assert.deepEqual(combined.get("P1")?.get("2026-08"), {
    period: "2026-08",
    quantitySold: 7,
    source: "POS_ACTUAL"
  });
});

test("clean short history remains usable through a fallback model", () => {
  const eligibility = assessSarimaEligibility(
    "P1",
    "Product 1",
    Array.from({ length: 8 }, (_, index) => ({
      period: `2026-${String(index + 1).padStart(2, "0")}`,
      quantitySold: 5 + (index % 3),
      source: "POS_ACTUAL" as const
    }))
  );

  assert.equal(eligibility.status, "INSUFFICIENT_HISTORY");
  assert.equal(eligibility.observationCount, 8);
});

test("unchanged per-product history is reusable without another SARIMA fit", () => {
  const historical = [
    {
      category: "Beverages",
      period: "2026-07",
      productId: "P1",
      productName: "Product 1",
      quantitySold: 10,
      sellingPrice: 20
    },
    {
      category: "Beverages",
      period: "2026-08",
      productId: "P1",
      productName: "Product 1",
      quantitySold: 12,
      sellingPrice: 20
    }
  ];
  const input: ProductHistoricalSeries = {
    category: "Beverages",
    historical,
    productId: "P1",
    productName: "Product 1",
    sellingPrice: 20
  };
  const previous: ProductForecastDetail = {
    category: "Beverages",
    error: null,
    forecast: [],
    generatedAt: "2026-09-01T00:00:00.000Z",
    historical,
    metrics: {
      mae: null,
      mape: null,
      rmse: null,
      validationStrategy: "test",
      wape: null
    },
    model: "SARIMA",
    modelDetails: {
      aic: 1,
      converged: true,
      model: "SARIMA",
      order: [0, 1, 1],
      seasonalOrder: [0, 1, 1, 12]
    },
    productId: "P1",
    productName: "Product 1",
    sellingPrice: 20,
    status: "READY",
    warnings: []
  };

  assert.equal(sameForecastInput(input, previous), true);
  assert.equal(
    sameForecastInput(
      {
        ...input,
        historical: input.historical.map((point, index) =>
          index === 1 ? { ...point, quantitySold: point.quantitySold + 1 } : point
        )
      },
      previous
    ),
    false
  );
});

test("stock sold changes remain product-targeted while non-demand changes do not refit SARIMA", () => {
  assert.equal(getDomainChangeEffects("STOCK_SOLD").forecast, "AFFECTED_PRODUCTS");
  assert.equal(getDomainChangeEffects("STOCK_RECEIVED").forecast, "NONE");
  assert.equal(getDomainChangeEffects("PRODUCT_UPDATED").forecast, "NONE");
});
