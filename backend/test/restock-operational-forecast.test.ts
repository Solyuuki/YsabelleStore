import assert from "node:assert/strict";
import test from "node:test";

import { buildOperationalRestockForecast } from "../src/services/restockDemandForecastService.js";

const NOW = new Date("2026-09-15T12:00:00.000Z");

test("operational restock forecast turns current POS demand into an actionable quantity", () => {
  const forecast = buildOperationalRestockForecast({
    expiryRiskQuantity: 0,
    historicalSeries: [{ period: "2026-09", quantitySold: 25 }],
    incomingStock: 0,
    now: NOW,
    reorderLevel: 0,
    sellableStock: 1,
    targetStockLevel: 0
  });

  assert.equal(forecast.demandSource, "CURRENT_MONTH_POS");
  assert.equal(forecast.expected30d, 25);
  assert.equal(forecast.suggestedQuantity, 24);
  assert.equal(forecast.riskLevel, "CRITICAL");
  assert.ok(forecast.projectedStockoutDate);
  assert.equal(forecast.recommendedActionDate, NOW.toISOString());
});

test("operational restock forecast subtracts already incoming stock", () => {
  const forecast = buildOperationalRestockForecast({
    expiryRiskQuantity: 0,
    historicalSeries: [{ period: "2026-09", quantitySold: 25 }],
    incomingStock: 24,
    now: NOW,
    reorderLevel: 0,
    sellableStock: 1,
    targetStockLevel: 0
  });

  assert.equal(forecast.expected30d, 25);
  assert.equal(forecast.suggestedQuantity, 0);
});

test("operational restock forecast uses recent completed POS months without SARIMA history", () => {
  const forecast = buildOperationalRestockForecast({
    expiryRiskQuantity: 0,
    historicalSeries: [
      { period: "2026-06", quantitySold: 18 },
      { period: "2026-07", quantitySold: 24 },
      { period: "2026-08", quantitySold: 30 }
    ],
    incomingStock: 0,
    now: NOW,
    reorderLevel: 0,
    sellableStock: 10,
    targetStockLevel: 0
  });

  assert.equal(forecast.demandSource, "RECENT_POS_SALES");
  assert.equal(forecast.expected30d, 24);
  assert.equal(forecast.suggestedQuantity, 14);
});

test("operational restock forecast can use stock policy when POS demand is unavailable", () => {
  const forecast = buildOperationalRestockForecast({
    expiryRiskQuantity: 0,
    historicalSeries: [],
    incomingStock: 0,
    now: NOW,
    reorderLevel: 5,
    sellableStock: 3,
    targetStockLevel: 10
  });

  assert.equal(forecast.demandSource, "NO_POS_HISTORY");
  assert.equal(forecast.expected30d, 0);
  assert.equal(forecast.suggestedQuantity, 7);
});
