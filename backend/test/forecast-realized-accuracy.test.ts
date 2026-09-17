import assert from "node:assert/strict";
import test from "node:test";

import { applyRealizedAccuracyFeedback } from "../src/modules/forecasting/forecast-realized-accuracy.service.js";
import type { ProductForecastDetail } from "../src/modules/forecasting/forecast.types.js";

function detail(): ProductForecastDetail {
  return {
    category: "Beverages",
    error: null,
    forecast: [
      {
        comparisonSalesQuantity: 10,
        differenceVersus2025: 2,
        forecastVariancePercentage: 20,
        lowerConfidence: 9,
        percentageChangeVersus2025: 20,
        period: "2026-09-01",
        predictedQuantity: 12,
        recommendedQuantity: 12,
        sameMonthLastYear: 10,
        upperConfidence: 15
      }
    ],
    generatedAt: "2026-09-01T00:00:00.000Z",
    historical: [
      {
        category: "Beverages",
        period: "2026-08",
        productId: "P1",
        productName: "Product 1",
        quantitySold: 11,
        sellingPrice: 20
      }
    ],
    metrics: {
      mae: 1,
      mape: 1,
      rmse: 1,
      validationStrategy: "test",
      wape: 1
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
}

test("realized accuracy compares the previous issued forecast with the newest completed actual", () => {
  const current = detail();
  current.historical.push({
    category: "Beverages",
    period: "2026-09",
    productId: "P1",
    productName: "Product 1",
    quantitySold: 10,
    sellingPrice: 20
  });
  const previous = detail();

  const result = applyRealizedAccuracyFeedback(current, previous);

  assert.equal(result.accuracyFeedback?.evaluatedPeriod, "2026-09-01");
  assert.equal(result.accuracyFeedback?.actualQuantity, 10);
  assert.equal(result.accuracyFeedback?.predictedQuantity, 12);
  assert.equal(result.accuracyFeedback?.signedError, 2);
  assert.equal(result.accuracyFeedback?.absoluteError, 2);
  assert.equal(result.accuracyFeedback?.absolutePercentageError, 20);
  assert.match(result.accuracyFeedback?.strategy ?? "", /Realized forecast-vs-actual/);
});

test("realized accuracy leaves diagnostics unchanged when no earlier forecast covered the month", () => {
  const current = detail();
  current.accuracyFeedback = {
    absoluteError: 1,
    absolutePercentageError: 10,
    actualQuantity: 10,
    evaluatedPeriod: "2026-08-01",
    predictedQuantity: 11,
    signedError: 1,
    strategy: "existing diagnostic"
  };
  const previous = detail();
  previous.forecast = [];

  const result = applyRealizedAccuracyFeedback(current, previous);

  assert.equal(result.accuracyFeedback?.strategy, "existing diagnostic");
});
