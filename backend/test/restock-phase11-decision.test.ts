import assert from "node:assert/strict";
import test from "node:test";

import { buildRestockForecastDecision } from "../src/services/restockForecastDecisionService.js";
import {
  reconcileDraftRestockLine,
  requiresAutomatedQuantityReview
} from "../src/services/restockDraftReconciliation.js";
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

test("automatic stock health marks zero sellable stock as out of stock from actual stock truth", () => {
  const health = classifyStockHealth({
    asOf: STOCK_HEALTH_NOW,
    historicalSeries: recentSales(30, 30, 30),
    sellableStock: 0
  });

  assert.equal(health.status, "OUT_OF_STOCK");
  assert.equal(health.coverageDays, 0);
  assert.equal(health.demandSource, "RECENT_SALES");
});

test("automatic stock health marks less than 30 days of actual demand cover as low stock", () => {
  const health = classifyStockHealth({
    asOf: STOCK_HEALTH_NOW,
    historicalSeries: recentSales(30, 30, 30),
    sellableStock: 20
  });

  assert.equal(health.status, "LOW_STOCK");
  assert.equal(health.coverageDays, 20);
  assert.equal(health.demandSource, "RECENT_SALES");
});

test("automatic stock health marks 30 to 90 days of actual demand cover as normal", () => {
  const health = classifyStockHealth({
    asOf: STOCK_HEALTH_NOW,
    historicalSeries: recentSales(30, 30, 30),
    sellableStock: 60
  });

  assert.equal(health.status, "NORMAL");
  assert.equal(health.coverageDays, 60);
  assert.equal(health.demandSource, "RECENT_SALES");
});

test("automatic stock health marks more than 90 days of actual demand cover as overstock", () => {
  const health = classifyStockHealth({
    asOf: STOCK_HEALTH_NOW,
    historicalSeries: recentSales(30, 30, 30),
    sellableStock: 100
  });

  assert.equal(health.status, "OVERSTOCK");
  assert.equal(health.coverageDays, 100);
  assert.equal(health.demandSource, "RECENT_SALES");
});

test("automatic stock health uses the last three completed actual-sales months", () => {
  const health = classifyStockHealth({
    asOf: STOCK_HEALTH_NOW,
    historicalSeries: recentSales(20, 30, 40),
    sellableStock: 45
  });

  assert.equal(health.status, "NORMAL");
  assert.equal(health.monthlyDemand, 30);
  assert.equal(health.coverageDays, 45);
  assert.equal(health.demandSource, "RECENT_SALES");
  assert.equal(health.confidence, "MEDIUM");
});

test("automatic stock health lowers confidence when only part of recent sales history exists", () => {
  const health = classifyStockHealth({
    asOf: STOCK_HEALTH_NOW,
    historicalSeries: [{ period: "2026-08", quantitySold: 30 }],
    sellableStock: 20
  });

  assert.equal(health.demandSource, "RECENT_SALES");
  assert.equal(health.confidence, "LOW");
});

test("automatic stock health holds normal with low confidence when completed demand history is missing", () => {
  const health = classifyStockHealth({
    asOf: STOCK_HEALTH_NOW,
    historicalSeries: [{ period: "2026-09", quantitySold: 12 }],
    sellableStock: 25
  });

  assert.equal(health.status, "NORMAL");
  assert.equal(health.coverageDays, null);
  assert.equal(health.demandSource, "INSUFFICIENT_HISTORY");
  assert.equal(health.confidence, "LOW");
});

test("automatic stock health reacts to current-month POS demand when stock is clearly low", () => {
  const health = classifyStockHealth({
    asOf: STOCK_HEALTH_NOW,
    historicalSeries: [{ period: "2026-09", quantitySold: 25 }],
    sellableStock: 1
  });

  assert.equal(health.status, "LOW_STOCK");
  assert.equal(health.coverageDays, 1.2);
  assert.equal(health.monthlyDemand, 25);
  assert.equal(health.demandSource, "RECENT_SALES");
  assert.equal(health.confidence, "LOW");
  assert.match(health.reason, /current-month actual sales/);
});

test("automatic stock health marks positive stock with zero recent actual demand as overstock", () => {
  const health = classifyStockHealth({
    asOf: STOCK_HEALTH_NOW,
    historicalSeries: recentSales(0, 0, 0),
    sellableStock: 25
  });

  assert.equal(health.status, "OVERSTOCK");
  assert.equal(health.monthlyDemand, 0);
  assert.equal(health.demandSource, "RECENT_SALES");
});


test("monthly automated draft is idempotent across 10,000 identical worker runs", () => {
  const action = {
    quantity: 17,
    recommendationId: "forecast-1",
    recommendationSource: "SARIMA" as const
  };
  const existing = {
    isSelected: true,
    ownerOverrideReason: null,
    recommendationId: "forecast-1",
    recommendationSource: "SARIMA" as const,
    recommendedQuantity: 17,
    requestedQuantity: 17
  };

  for (let run = 0; run < 10_000; run += 1) {
    assert.equal(reconcileDraftRestockLine(existing, action), null);
  }
  assert.equal(existing.requestedQuantity, 17);
});

test("reconciliation repairs an accumulated draft instead of incrementing it", () => {
  const repaired = reconcileDraftRestockLine(
    {
      isSelected: true,
      ownerOverrideReason: null,
      recommendationId: "forecast-1",
      recommendationSource: "SARIMA",
      recommendedQuantity: 202_270,
      requestedQuantity: 202_270
    },
    {
      quantity: 17,
      recommendationId: "forecast-1",
      recommendationSource: "SARIMA"
    }
  );
  assert.deepEqual(repaired, {
    recommendationId: "forecast-1",
    recommendationSource: "SARIMA",
    recommendedQuantity: 17,
    requestedQuantity: 17
  });
  assert.equal(
    reconcileDraftRestockLine(
      {
        isSelected: true,
        ownerOverrideReason: null,
        ...repaired!
      },
      {
        quantity: 17,
        recommendationId: "forecast-1",
        recommendationSource: "SARIMA"
      }
    ),
    null
  );
});

test("owner quantity overrides, deselections and manual lines survive worker reconciliation", () => {
  const action = {
    quantity: 22,
    recommendationId: "forecast-2",
    recommendationSource: "LOW_STOCK" as const
  };
  const baseline = {
    isSelected: true,
    ownerOverrideReason: "Confirmed supplier pallet.",
    recommendationId: "forecast-1",
    recommendationSource: "SARIMA" as const,
    recommendedQuantity: 17,
    requestedQuantity: 50
  };
  assert.deepEqual(reconcileDraftRestockLine(baseline, action), {
    recommendationId: "forecast-2",
    recommendationSource: "LOW_STOCK",
    recommendedQuantity: 22,
    requestedQuantity: 50
  });
  assert.equal(
    reconcileDraftRestockLine(
      { ...baseline, recommendationSource: "MANUAL" },
      action
    ),
    null
  );
  assert.equal(
    reconcileDraftRestockLine(
      {
        ...baseline,
        isSelected: false,
        ownerOverrideReason: null,
        recommendedQuantity: 17,
        requestedQuantity: 17
      },
      action
    )?.requestedQuantity,
    17
  );
});

test("automated approval blocks inflated quantities while allowing normal recommendation drift", () => {
  assert.equal(requiresAutomatedQuantityReview(202_270, 17, null), true);
  assert.equal(requiresAutomatedQuantityReview(17, 17, null), false);
  assert.equal(requiresAutomatedQuantityReview(22, 17, null), false);
  assert.equal(requiresAutomatedQuantityReview(200, 0, null), true);
  assert.equal(
    requiresAutomatedQuantityReview(50, 17, "Owner documented a supplier pallet."),
    false
  );
});
