import type { RestockPlanningCandidate } from "@/services/restockApi";

export const RESTOCK_FORECAST_DEMO_PRODUCT_ID = "__restock-forecast-demo__";

function monthStart(base: Date, offset: number) {
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, 1)).toISOString();
}

export function createRestockForecastDemo(): RestockPlanningCandidate {
  const now = new Date();
  const historicalQuantities = [6, 7, 8, 7, 9, 10, 9, 11, 12, 10, 13, 14];
  const forecastQuantities = [15, 17, 19, 21, 23, 25];

  const historical = historicalQuantities.map((quantitySold, index) => ({
    period: monthStart(now, index - historicalQuantities.length),
    quantitySold
  }));

  const points = forecastQuantities.map((predictedQuantity, index) => ({
    period: monthStart(now, index + 1),
    predictedQuantity,
    lowerConfidence: Math.max(0, predictedQuantity - 3),
    upperConfidence: predictedQuantity + 4
  }));

  return {
    expiryRiskQuantity: 2,
    forecast: {
      batchId: "demo-sarimax-batch",
      currentMonthDemand: forecastQuantities[0] ?? 0,
      generatedAt: now.toISOString(),
      historical,
      modelName: "SARIMAX demo",
      points
    },
    forecastDecision: {
      currentMonthDemand: forecastQuantities[0] ?? 0,
      confidenceAdjustedDemand: 19,
      projectedEndingStock: 11,
      projectedStockoutDate: monthStart(now, 2),
      suggestedQuantity: 34,
      riskLevel: "HIGH",
      recommendedActionDate: now.toISOString(),
      reason:
        "Temporary QA data: forecast demand is projected to consume available sellable stock before the replenishment horizon."
    },
    incomingStock: 0,
    physicalOnHand: 28,
    product: {
      barcode: null,
      id: RESTOCK_FORECAST_DEMO_PRODUCT_ID,
      name: "555 Tuna Adobo — Test forecast",
      reorderLevel: 15,
      sku: "DEMO-SARIMAX-001",
      targetStockLevel: 45
    },
    quarantinedStock: 0,
    rationale:
      "Temporary QA data only. Sellable stock starts at 28 units, 2 units are treated as expiry exposure, and forecast demand rises across the next six months.",
    recommendationId: null,
    recommendationSource: "SARIMA",
    recommendedQuantity: 34,
    sellableStock: 28
  };
}
