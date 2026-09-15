import { prisma } from "../database/prismaClient.js";

const DAYS_PER_MONTH = 30;
const RECENT_COMPLETED_MONTHS = 3;
const HISTORY_MONTHS = 6;
const PLANNING_LEAD_DAYS = 14;
const MILLISECONDS_PER_DAY = 86_400_000;

export type RestockDemandSource = "CURRENT_MONTH_POS" | "RECENT_POS_SALES" | "NO_POS_HISTORY";
export type RestockDemandConfidence = "HIGH" | "MEDIUM" | "LOW";
export type RestockDemandRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type RestockSalesPoint = {
  period: string;
  quantitySold: number;
};

export type OperationalRestockForecast = {
  confidence: RestockDemandConfidence;
  confidenceAdjustedDemand: number;
  demandSource: RestockDemandSource;
  expected30d: number;
  historical: RestockSalesPoint[];
  points: Array<{
    lowerConfidence: number | null;
    period: string;
    predictedQuantity: number;
    upperConfidence: number | null;
  }>;
  projectedEndingStock: number;
  projectedStockoutDate: string | null;
  reason: string;
  recommendedActionDate: string | null;
  riskLevel: RestockDemandRisk;
  suggestedQuantity: number;
};

type BuildOperationalRestockForecastInput = {
  expiryRiskQuantity: number;
  historicalSeries?: RestockSalesPoint[];
  incomingStock: number;
  now?: Date;
  reorderLevel: number;
  sellableStock: number;
  targetStockLevel: number;
};

function finiteNonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function shiftMonths(date: Date, months: number) {
  const shifted = monthStart(date);
  shifted.setUTCMonth(shifted.getUTCMonth() + months);
  return shifted;
}

function recentCompletedMonthKeys(now: Date) {
  return Array.from({ length: RECENT_COMPLETED_MONTHS }, (_, index) =>
    monthKey(shiftMonths(now, -(RECENT_COMPLETED_MONTHS - index)))
  );
}

function salesByPeriod(series: RestockSalesPoint[]) {
  const totals = new Map<string, number>();
  for (const point of series) {
    if (!Number.isFinite(point.quantitySold)) continue;
    totals.set(point.period, (totals.get(point.period) ?? 0) + Math.max(0, point.quantitySold));
  }
  return totals;
}

function resolveExpectedDemand(series: RestockSalesPoint[], now: Date) {
  const totals = salesByPeriod(series);
  const currentMonthSales = totals.get(monthKey(now)) ?? 0;
  const completedValues = recentCompletedMonthKeys(now)
    .filter((key) => totals.has(key))
    .map((key) => totals.get(key) ?? 0);
  const completedAverage = completedValues.length
    ? completedValues.reduce((sum, value) => sum + value, 0) / completedValues.length
    : 0;
  const expected30d = Math.round(Math.max(currentMonthSales, completedAverage) * 10) / 10;

  if (currentMonthSales > 0 && currentMonthSales >= completedAverage) {
    return {
      confidence:
        completedValues.length >= RECENT_COMPLETED_MONTHS
          ? ("HIGH" as const)
          : completedValues.length > 0
            ? ("MEDIUM" as const)
            : ("LOW" as const),
      demandSource: "CURRENT_MONTH_POS" as const,
      expected30d
    };
  }

  if (completedValues.length > 0) {
    return {
      confidence:
        completedValues.length >= RECENT_COMPLETED_MONTHS ? ("HIGH" as const) : ("MEDIUM" as const),
      demandSource: "RECENT_POS_SALES" as const,
      expected30d
    };
  }

  return {
    confidence: "LOW" as const,
    demandSource: "NO_POS_HISTORY" as const,
    expected30d: 0
  };
}

function projectedStockoutDate(availablePosition: number, expected30d: number, now: Date) {
  if (availablePosition <= 0) return now.toISOString();
  if (expected30d <= 0) return null;
  const dailyDemand = expected30d / DAYS_PER_MONTH;
  return new Date(
    now.getTime() + (availablePosition / dailyDemand) * MILLISECONDS_PER_DAY
  ).toISOString();
}

function riskFor(stockoutDate: string | null, suggestedQuantity: number, now: Date) {
  if (stockoutDate) {
    const daysUntilStockout = Math.max(
      0,
      (new Date(stockoutDate).getTime() - now.getTime()) / MILLISECONDS_PER_DAY
    );
    if (daysUntilStockout <= 7) return "CRITICAL" as const;
    if (daysUntilStockout <= 14) return "HIGH" as const;
    if (daysUntilStockout <= 30) return "MEDIUM" as const;
  }
  return suggestedQuantity > 0 ? ("MEDIUM" as const) : ("LOW" as const);
}

function actionDateFor(
  riskLevel: RestockDemandRisk,
  stockoutDate: string | null,
  suggestedQuantity: number,
  now: Date
) {
  if (suggestedQuantity <= 0 || riskLevel === "LOW") return null;
  if (riskLevel === "CRITICAL" || riskLevel === "HIGH" || !stockoutDate) {
    return now.toISOString();
  }
  const stockout = new Date(stockoutDate);
  const recommended = new Date(stockout.getTime() - PLANNING_LEAD_DAYS * MILLISECONDS_PER_DAY);
  return (recommended.getTime() <= now.getTime() ? now : recommended).toISOString();
}

export function buildOperationalRestockForecast(
  input: BuildOperationalRestockForecastInput
): OperationalRestockForecast {
  const now = input.now ?? new Date();
  const historical = [...(input.historicalSeries ?? [])].sort((left, right) =>
    left.period.localeCompare(right.period)
  );
  const demand = resolveExpectedDemand(historical, now);
  const sellableStock = finiteNonNegative(input.sellableStock);
  const incomingStock = finiteNonNegative(input.incomingStock);
  const expiryRiskQuantity = finiteNonNegative(input.expiryRiskQuantity);
  const targetStockLevel = finiteNonNegative(input.targetStockLevel);
  const reorderLevel = finiteNonNegative(input.reorderLevel);
  const availablePosition = Math.max(0, sellableStock + incomingStock - expiryRiskQuantity);
  const projectedEndingStock = availablePosition - demand.expected30d;
  const projectedStockout = projectedStockoutDate(availablePosition, demand.expected30d, now);
  const demandAndTargetGap = Math.max(
    0,
    Math.ceil(
      targetStockLevel + demand.expected30d + expiryRiskQuantity - sellableStock - incomingStock
    )
  );
  const reorderGap =
    reorderLevel > 0 && sellableStock + incomingStock <= reorderLevel
      ? Math.max(0, Math.ceil(reorderLevel + 1 - sellableStock - incomingStock))
      : 0;
  const suggestedQuantity = Math.max(demandAndTargetGap, reorderGap);
  const riskLevel = riskFor(projectedStockout, suggestedQuantity, now);
  const recommendedActionDate = actionDateFor(riskLevel, projectedStockout, suggestedQuantity, now);
  const reason =
    suggestedQuantity <= 0
      ? demand.expected30d > 0
        ? `Recent POS demand of ${Math.ceil(demand.expected30d)} units over 30 days is covered by sellable and incoming stock.`
        : "No recent POS demand or stock-policy gap currently requires replenishment."
      : demand.expected30d > 0
        ? `${riskLevel} replenishment risk: recent POS sales imply about ${Math.ceil(demand.expected30d)} units of demand over the next 30 days.`
        : `Restore stock toward the configured target/reorder policy.`;

  return {
    confidence: demand.confidence,
    confidenceAdjustedDemand: demand.expected30d,
    demandSource: demand.demandSource,
    expected30d: demand.expected30d,
    historical,
    points: [
      {
        lowerConfidence: null,
        period: shiftMonths(now, 1).toISOString(),
        predictedQuantity: demand.expected30d,
        upperConfidence: null
      }
    ],
    projectedEndingStock,
    projectedStockoutDate: projectedStockout,
    reason,
    recommendedActionDate,
    riskLevel,
    suggestedQuantity
  };
}

export async function loadOperationalPosSales(productIds: string[], now = new Date()) {
  const uniqueProductIds = [...new Set(productIds)];
  const byProduct = new Map<string, RestockSalesPoint[]>();
  if (uniqueProductIds.length === 0) return byProduct;

  const historyStart = shiftMonths(now, -HISTORY_MONTHS);
  const items = await prisma.saleItem.findMany({
    select: {
      productId: true,
      quantity: true,
      sale: { select: { saleDate: true } }
    },
    where: {
      productId: { in: uniqueProductIds },
      sale: {
        saleDate: { gte: historyStart },
        status: "COMPLETED"
      }
    }
  });
  const totals = new Map<string, Map<string, number>>();

  for (const item of items) {
    const productTotals = totals.get(item.productId) ?? new Map<string, number>();
    const period = monthKey(item.sale.saleDate);
    productTotals.set(period, (productTotals.get(period) ?? 0) + Math.max(0, item.quantity));
    totals.set(item.productId, productTotals);
  }

  for (const productId of uniqueProductIds) {
    const productTotals = totals.get(productId);
    const series = productTotals
      ? [...productTotals.entries()]
          .map(([period, quantitySold]) => ({ period, quantitySold }))
          .sort((left, right) => left.period.localeCompare(right.period))
      : [];
    byProduct.set(productId, series);
  }

  return byProduct;
}
