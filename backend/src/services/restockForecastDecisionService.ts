export type RestockForecastRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type RestockForecastPointInput = {
  period: string;
  predictedQuantity: number;
  lowerConfidence: number | null;
  upperConfidence: number | null;
};

export type RestockForecastDecisionInput = {
  sellableStock: number;
  incomingStock: number;
  expiryRiskQuantity: number;
  targetStockLevel: number;
  reorderLevel: number;
  forecast: RestockForecastPointInput[];
  now?: Date;
};

export type RestockForecastDecision = {
  currentMonthDemand: number;
  confidenceAdjustedDemand: number;
  projectedEndingStock: number;
  projectedStockoutDate: string | null;
  suggestedQuantity: number;
  riskLevel: RestockForecastRisk;
  recommendedActionDate: string | null;
  reason: string;
};

const DAYS_PER_MONTH = 30.4375;
const MILLISECONDS_PER_DAY = 86_400_000;

function finiteNonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function isoDate(value: Date) {
  return value.toISOString();
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * MILLISECONDS_PER_DAY);
}

function projectedStockoutDate(
  availablePosition: number,
  monthlyDemand: number,
  now: Date
): string | null {
  if (availablePosition <= 0) return isoDate(now);
  if (monthlyDemand <= 0) return null;

  const dailyDemand = monthlyDemand / DAYS_PER_MONTH;
  if (dailyDemand <= 0) return null;

  return isoDate(addDays(now, availablePosition / dailyDemand));
}

function riskFor(daysUntilStockout: number | null, projectedEndingStock: number, reorderLevel: number) {
  if (daysUntilStockout !== null && daysUntilStockout <= 7) return "CRITICAL" as const;
  if (daysUntilStockout !== null && daysUntilStockout <= 14) return "HIGH" as const;
  if (daysUntilStockout !== null && daysUntilStockout <= 30) return "MEDIUM" as const;
  if (projectedEndingStock <= reorderLevel) return "MEDIUM" as const;
  return "LOW" as const;
}

function actionDateFor(
  riskLevel: RestockForecastRisk,
  stockoutDate: string | null,
  suggestedQuantity: number,
  now: Date
) {
  if (suggestedQuantity <= 0 || riskLevel === "LOW") return null;
  if (riskLevel === "CRITICAL" || riskLevel === "HIGH") return isoDate(now);
  if (!stockoutDate) return isoDate(now);

  const stockout = new Date(stockoutDate);
  const recommended = addDays(stockout, -14);
  return isoDate(recommended.getTime() <= now.getTime() ? now : recommended);
}

function decisionReason(
  riskLevel: RestockForecastRisk,
  stockoutDate: string | null,
  suggestedQuantity: number,
  currentMonthDemand: number,
  expiryRiskQuantity: number
) {
  if (suggestedQuantity <= 0) {
    return "Forecast demand is covered by sellable and incoming stock at the current target policy.";
  }

  const demandText = `${Math.ceil(currentMonthDemand)} forecast unit${Math.ceil(currentMonthDemand) === 1 ? "" : "s"}`;
  const expiryText =
    expiryRiskQuantity > 0
      ? ` and ${Math.ceil(expiryRiskQuantity)} unit${Math.ceil(expiryRiskQuantity) === 1 ? "" : "s"} exposed to expiry within the planning window`
      : "";

  if (stockoutDate) {
    return `${riskLevel} replenishment risk: ${demandText}${expiryText} can deplete the projected available position before the target stock policy is restored.`;
  }

  return `${demandText}${expiryText} create a replenishment gap against the target stock policy.`;
}

export function buildRestockForecastDecision(
  input: RestockForecastDecisionInput
): RestockForecastDecision {
  const now = input.now ?? new Date();
  const firstForecast = input.forecast[0] ?? null;
  const currentMonthDemand = finiteNonNegative(firstForecast?.predictedQuantity ?? 0);
  const confidenceAdjustedDemand = Math.max(
    currentMonthDemand,
    finiteNonNegative(firstForecast?.upperConfidence ?? currentMonthDemand)
  );
  const sellableStock = finiteNonNegative(input.sellableStock);
  const incomingStock = finiteNonNegative(input.incomingStock);
  const expiryRiskQuantity = finiteNonNegative(input.expiryRiskQuantity);
  const targetStockLevel = finiteNonNegative(input.targetStockLevel);
  const reorderLevel = finiteNonNegative(input.reorderLevel);
  const availablePosition = Math.max(0, sellableStock + incomingStock - expiryRiskQuantity);
  const projectedEndingStock = availablePosition - currentMonthDemand;
  const stockoutDate = projectedStockoutDate(availablePosition, confidenceAdjustedDemand, now);
  const daysUntilStockout = stockoutDate
    ? Math.max(0, (new Date(stockoutDate).getTime() - now.getTime()) / MILLISECONDS_PER_DAY)
    : null;
  const suggestedQuantity = Math.max(
    0,
    Math.ceil(targetStockLevel + currentMonthDemand + expiryRiskQuantity - sellableStock - incomingStock)
  );
  const riskLevel = riskFor(daysUntilStockout, projectedEndingStock, reorderLevel);
  const recommendedActionDate = actionDateFor(
    riskLevel,
    stockoutDate,
    suggestedQuantity,
    now
  );

  return {
    confidenceAdjustedDemand,
    currentMonthDemand,
    projectedEndingStock,
    projectedStockoutDate: stockoutDate,
    reason: decisionReason(
      riskLevel,
      stockoutDate,
      suggestedQuantity,
      currentMonthDemand,
      expiryRiskQuantity
    ),
    recommendedActionDate,
    riskLevel,
    suggestedQuantity
  };
}
