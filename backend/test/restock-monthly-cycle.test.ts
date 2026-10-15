import assert from "node:assert/strict";
import test from "node:test";

import {
  monthlyRestockCycle,
  nextMonthlyRestockDate
} from "../src/services/restockMonthlyCyclePolicy.js";
import { buildOperationalRestockForecast } from "../src/services/restockDemandForecastService.js";
import { buildRestockForecastDecision } from "../src/services/restockForecastDecisionService.js";

test("October 15 is preview-only and targets November 1 Manila", () => {
  const cycle = monthlyRestockCycle(new Date("2026-10-15T08:00:00.000Z"));
  assert.equal(cycle.currentMonth, "2026-10");
  assert.equal(cycle.nextMonth, "2026-11");
  assert.equal(cycle.nextRestockAt, "2026-10-31T16:00:00.000Z");
  assert.equal(cycle.automationEnabled, false);
});

test("Manila month rollover activates the new cycle at midnight", () => {
  assert.equal(
    nextMonthlyRestockDate(new Date("2026-10-31T15:59:59.000Z")),
    "2026-10-31T16:00:00.000Z"
  );
  const november = monthlyRestockCycle(new Date("2026-10-31T16:00:00.000Z"));
  assert.equal(november.currentMonth, "2026-11");
  assert.equal(november.nextRestockAt, "2026-11-30T16:00:00.000Z");
  assert.equal(november.automationEnabled, true);
});

test("December and year rollover use the Philippine business month", () => {
  const cycle = monthlyRestockCycle(new Date("2026-12-31T16:00:00.000Z"));
  assert.equal(cycle.currentMonth, "2027-01");
  assert.equal(cycle.nextMonth, "2027-02");
  assert.equal(cycle.nextRestockAt, "2027-01-31T16:00:00.000Z");
});

test("zero-demand stock-policy gap remains a November preview", () => {
  const now = new Date("2026-10-15T08:00:00.000Z");
  const fallback = buildOperationalRestockForecast({
    expiryRiskQuantity: 0,
    historicalSeries: [],
    incomingStock: 0,
    now,
    reorderLevel: 5,
    sellableStock: 12,
    targetStockLevel: 30
  });
  assert.equal(fallback.expected30d, 0);
  assert.equal(fallback.suggestedQuantity, 18);
  assert.equal(fallback.recommendedActionDate, "2026-10-31T16:00:00.000Z");

  const sarima = buildRestockForecastDecision({
    expiryRiskQuantity: 0,
    forecast: [
      { period: "2026-11-01", predictedQuantity: 0, lowerConfidence: null, upperConfidence: null }
    ],
    incomingStock: 0,
    now,
    reorderLevel: 5,
    sellableStock: 12,
    targetStockLevel: 30
  });
  assert.equal(sarima.suggestedQuantity, 18);
  assert.equal(sarima.recommendedActionDate, "2026-10-31T16:00:00.000Z");
});

test("true urgent stockout still receives an immediate alert", () => {
  const now = new Date("2026-10-15T08:00:00.000Z");
  const urgent = buildOperationalRestockForecast({
    expiryRiskQuantity: 0,
    historicalSeries: [{ period: "2026-10", quantitySold: 30 }],
    incomingStock: 0,
    now,
    reorderLevel: 2,
    sellableStock: 1,
    targetStockLevel: 1
  });
  assert.equal(urgent.riskLevel, "CRITICAL");
  assert.equal(urgent.recommendedActionDate, now.toISOString());
});

test("a projected stockout before next activation bypasses monthly waiting", () => {
  const now = new Date("2026-10-02T08:00:00.000Z");
  const forecast = buildOperationalRestockForecast({
    expiryRiskQuantity: 0,
    historicalSeries: [{ period: "2026-10", quantitySold: 30 }],
    incomingStock: 0,
    now,
    reorderLevel: 0,
    sellableStock: 20,
    targetStockLevel: 0
  });
  assert.equal(forecast.suggestedQuantity, 10);
  assert.equal(forecast.riskLevel, "HIGH");
  assert.equal(forecast.recommendedActionDate, now.toISOString());

  const sarima = buildRestockForecastDecision({
    expiryRiskQuantity: 0,
    forecast: [
      { period: "2026-11-01", predictedQuantity: 30, lowerConfidence: null, upperConfidence: null }
    ],
    incomingStock: 0,
    now,
    reorderLevel: 0,
    sellableStock: 20,
    targetStockLevel: 0
  });
  assert.equal(sarima.riskLevel, "HIGH");
  assert.equal(sarima.recommendedActionDate, now.toISOString());
});
