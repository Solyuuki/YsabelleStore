import assert from "node:assert/strict";
import test from "node:test";

import { applyReconstructedComparisonOverlay } from "../src/modules/forecasting/forecast-comparison-overlay.service.js";
import type {
  HistoricalSalesPoint,
  ProductForecastDetail
} from "../src/modules/forecasting/forecast.types.js";

function detail(): ProductForecastDetail {
  return {
    category: "Beverages",
    error: null,
    forecast: [
      {
        comparisonSalesEstimated: false,
        comparisonSalesQuantity: null,
        differenceVersus2025: null,
        forecastVariancePercentage: null,
        lowerConfidence: null,
        percentageChangeVersus2025: null,
        period: "2027-01-01",
        predictedQuantity: 18,
        recommendedQuantity: 18,
        sameMonthLastYear: null,
        upperConfidence: null
      },
      {
        comparisonSalesEstimated: false,
        comparisonSalesQuantity: 20,
        differenceVersus2025: 2,
        forecastVariancePercentage: 10,
        lowerConfidence: null,
        percentageChangeVersus2025: 10,
        period: "2027-02-01",
        predictedQuantity: 22,
        recommendedQuantity: 22,
        sameMonthLastYear: 20,
        upperConfidence: null
      }
    ],
    generatedAt: "2026-09-15T12:00:00.000Z",
    historical: [
      {
        category: "Beverages",
        period: "2025-12",
        productId: "workbook:P266",
        productName: "100 Plus Active Bottle",
        quantitySold: 19,
        sellingPrice: 10
      }
    ],
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
    productId: "workbook:P266",
    productName: "100 Plus Active Bottle",
    sellingPrice: 10,
    status: "READY",
    warnings: []
  };
}

function reconstructedPoint(period: string, quantitySold: number): HistoricalSalesPoint {
  return {
    category: "Beverages",
    period,
    productId: "P266",
    productName: "100 Plus Active Bottle",
    quantitySold,
    sellingPrice: 10
  };
}

test("reconstructed comparison fills only missing prior-year values", () => {
  const source = detail();
  const reconstructed = new Map([
    [
      "P266",
      [reconstructedPoint("2026-01", 15), reconstructedPoint("2026-02", 99)]
    ]
  ]);

  const result = applyReconstructedComparisonOverlay(source, reconstructed);

  assert.equal(result.forecast[0]?.comparisonSalesQuantity, 15);
  assert.equal(result.forecast[0]?.comparisonSalesEstimated, true);
  assert.equal(result.forecast[0]?.sameMonthLastYear, 15);
  assert.equal(result.forecast[0]?.forecastVariancePercentage, 20);
  assert.equal(result.forecast[0]?.differenceVersus2025, 3);

  assert.equal(result.forecast[1]?.comparisonSalesQuantity, 20);
  assert.equal(result.forecast[1]?.comparisonSalesEstimated, false);
  assert.equal(result.forecast[1]?.forecastVariancePercentage, 10);
});

test("comparison overlay never adds reconstructed values to SARIMA training history", () => {
  const source = detail();
  const originalHistorical = structuredClone(source.historical);
  const reconstructed = new Map([["P266", [reconstructedPoint("2026-01", 15)]]]);

  const result = applyReconstructedComparisonOverlay(source, reconstructed);

  assert.deepEqual(result.historical, originalHistorical);
  assert.equal(result.historical.some((point) => point.period.startsWith("2026-")), false);
});

test("database product identities are not overlaid from workbook reconstruction", () => {
  const source = { ...detail(), productId: "canonical-product-id" };
  const reconstructed = new Map([["P266", [reconstructedPoint("2026-01", 15)]]]);

  const result = applyReconstructedComparisonOverlay(source, reconstructed);

  assert.equal(result, source);
});
