import assert from "node:assert/strict";
import test from "node:test";

import { buildRestockForecastDecision } from "../src/services/restockForecastDecisionService.js";
import { classifyStockHealth } from "../src/services/stockHealthService.js";

const NOW = new Date("2026-09-13T00:00:00.000Z");
const STOCK_HEALTH_NOW = new Date("2026-09-14T12:00:00.000Z");

function forecast(predictedQuantity: number, upperConfidence: number | null = null) {
  return [
    {
      lowerConfidence: null,
      period: "2026-09-01T00:00:00.000Z",
      predictedQuantity,
      upperConfidence
    }
  ];
}

function recentSales(june: number, july: number, august: number) {
  return [
    { period: "2026-06", quantitySold: june },
    { period: "2026-07", quantitySold: july },
    { period: "2026-08", quantitySold: august }
  ];
}

test("Phase 11 forecast decision reproduces target plus demand replenishment math", () => {
  const decision = buildRestockForecastDecision({
    expiryRiskQuantity: 0,
    forecast: forecast(67, 75),
    incomingStock: 0,
    now: NOW,
    reorderLevel: 15,
    sellableStock: 31,
    targetStockLevel: 80
  });

  assert.equal(decision.currentMonthDemand, 67);
  assert.equal(decision.suggestedQuantity, 116);
  assert.equal(decision.riskLevel, "HIGH");
  assert.equal(decision.recommendedActionDate, NOW.toISOString());
  assert.ok(decision.projectedStockoutDate);
});

test("Phase 11 subtracts approved incoming stock before suggesting an order", () => {
  const decision = buildRestockForecastDecision({
    expiryRiskQuantity: 0,
    forecast: forecast(40),
    incomingStock: 30,
    now: NOW,
    reorderLevel: 20,
    sellableStock: 60,
    targetStockLevel: 80
  });

  assert.equal(decision.suggestedQuantity, 30);
  assert.equal(decision.projectedEndingStock, 50);
  assert.equal(decision.riskLevel, "MEDIUM");
});

test("Phase 11 adds near-term expiry exposure to the replenishment gap", () => {
  const withoutExpiry = buildRestockForecastDecision({
    expiryRiskQuantity: 0,
    forecast: forecast(25),
    incomingStock: 0,
    now: NOW,
    reorderLevel: 10,
    sellableStock: 50,
    targetStockLevel: 50
  });
  const withExpiry = buildRestockForecastDecision({
    expiryRiskQuantity: 12,
    forecast: forecast(25),
    incomingStock: 0,
    now: NOW,
    reorderLevel: 10,
    sellableStock: 50,
    targetStockLevel: 50
  });

  assert.equal(withoutExpiry.suggestedQuantity, 25);
  assert.equal(withExpiry.suggestedQuantity, 37);
  assert.match(withExpiry.reason, /12 units exposed to expiry/);
});

test("Phase 11 returns no action when stock already covers forecast demand and target", () => {
  const decision = buildRestockForecastDecision({
    expiryRiskQuantity: 0,
    forecast: forecast(20),
    incomingStock: 20,
    now: NOW,
    reorderLevel: 20,
    sellableStock: 120,
    targetStockLevel: 80
  });

  assert.equal(decision.suggestedQuantity, 0);
  assert.equal(decision.riskLevel, "LOW");
  assert.equal(decision.recommendedActionDate, null);
  assert.match(decision.reason, /covered by sellable and incoming stock/);
});

test("automatic stock health marks zero sellable stock as out of stock", () => {
  const health = classifyStockHealth({
    asOf: STOCK_HEALTH_NOW,
    forecastMonthlyDemand: 30,
    sellableStock: 0
  });

  assert.equal(health.status, "OUT_OF_STOCK");
  assert.equal(health.coverageDays, 0);
  assert.equal(health.demandSource, "SARIMA");
});

test("automatic stock health marks less than 30 days of cover as low stock", () => {
  const health = classifyStockHealth({
    asOf: STOCK_HEALTH_NOW,
    forecastMonthlyDemand: 30,
    sellableStock: 20
  });

  assert.equal(health.status, "LOW_STOCK");
  assert.equal(health.coverageDays, 20);
  assert.equal(health.demandSource, "SARIMA");
});

test("automatic stock health marks 30 to 90 days of cover as normal", () => {
  const health = classifyStockHealth({
    asOf: STOCK_HEALTH_NOW,
    forecastMonthlyDemand: 30,
    sellableStock: 60
  });

  assert.equal(health.status, "NORMAL");
  assert.equal(health.coverageDays, 60);
});

test("automatic stock health marks more than 90 days of cover as overstock", () => {
  const health = classifyStockHealth({
    asOf: STOCK_HEALTH_NOW,
    forecastMonthlyDemand: 30,
    sellableStock: 100
  });

  assert.equal(health.status, "OVERSTOCK");
  assert.equal(health.coverageDays, 100);
});

test("automatic stock health falls back to recent completed sales when forecast is unavailable", () => {
  const health = classifyStockHealth({
    asOf: STOCK_HEALTH_NOW,
    forecastMonthlyDemand: 0,
    historicalSeries: recentSales(20, 30, 40),
    sellableStock: 45
  });

  assert.equal(health.status, "NORMAL");
  assert.equal(health.monthlyDemand, 30);
  assert.equal(health.coverageDays, 45);
  assert.equal(health.demandSource, "RECENT_SALES");
  assert.equal(health.confidence, "MEDIUM");
});

test("automatic stock health holds normal with low confidence when completed demand history is missing", () => {
  const health = classifyStockHealth({
    asOf: STOCK_HEALTH_NOW,
    forecastMonthlyDemand: null,
    historicalSeries: [{ period: "2026-09", quantitySold: 12 }],
    sellableStock: 25
  });

  assert.equal(health.status, "NORMAL");
  assert.equal(health.coverageDays, null);
  assert.equal(health.demandSource, "INSUFFICIENT_HISTORY");
  assert.equal(health.confidence, "LOW");
});

test("automatic stock health marks positive stock with zero recent demand as overstock", () => {
  const health = classifyStockHealth({
    asOf: STOCK_HEALTH_NOW,
    historicalSeries: recentSales(0, 0, 0),
    sellableStock: 25
  });

  assert.equal(health.status, "OVERSTOCK");
  assert.equal(health.monthlyDemand, 0);
  assert.equal(health.demandSource, "RECENT_SALES");
});
