import assert from "node:assert/strict";
import test from "node:test";

import { buildRestockForecastDecision } from "../src/services/restockForecastDecisionService.js";

const NOW = new Date("2026-09-13T00:00:00.000Z");

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
