const DAYS_PER_MONTH = 30;
const LOW_STOCK_COVERAGE_DAYS = 30;
const OVERSTOCK_COVERAGE_DAYS = 90;
const RECENT_COMPLETED_MONTHS = 3;

export type StockHealthStatus = "OUT_OF_STOCK" | "LOW_STOCK" | "NORMAL" | "OVERSTOCK";
export type StockHealthDemandSource = "RECENT_SALES" | "INSUFFICIENT_HISTORY";
export type StockHealthConfidence = "HIGH" | "MEDIUM" | "LOW";

export type StockHealthHistoryPoint = {
  period: string;
  quantitySold: number;
};

export type AutomaticStockHealth = {
  status: StockHealthStatus;
  coverageDays: number | null;
  monthlyDemand: number | null;
  demandSource: StockHealthDemandSource;
  confidence: StockHealthConfidence;
  reason: string;
};

type ClassifyStockHealthInput = {
  sellableStock: number;
  historicalSeries?: StockHealthHistoryPoint[];
  asOf?: Date;
};

type DemandSignal = {
  monthlyDemand: number | null;
  demandSource: StockHealthDemandSource;
  confidence: StockHealthConfidence;
  observedRecentMonths: number;
};

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function recentCompletedMonthKeys(asOf: Date) {
  const cursor = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), 1));
  const keys: string[] = [];

  for (let offset = 1; offset <= RECENT_COMPLETED_MONTHS; offset += 1) {
    const month = new Date(cursor);
    month.setUTCMonth(month.getUTCMonth() - offset);
    keys.push(monthKey(month));
  }

  return keys.reverse();
}

function resolveDemandSignal(input: ClassifyStockHealthInput): DemandSignal {
  const recentKeys = recentCompletedMonthKeys(input.asOf ?? new Date());
  const recentSet = new Set(recentKeys);
  const monthlySales = new Map<string, number>();

  for (const point of input.historicalSeries ?? []) {
    if (!recentSet.has(point.period) || !Number.isFinite(point.quantitySold)) continue;
    monthlySales.set(
      point.period,
      (monthlySales.get(point.period) ?? 0) + Math.max(0, point.quantitySold)
    );
  }

  if (monthlySales.size === 0) {
    return {
      confidence: "LOW",
      demandSource: "INSUFFICIENT_HISTORY",
      monthlyDemand: null,
      observedRecentMonths: 0
    };
  }

  const monthlyDemand =
    recentKeys.reduce((sum, key) => sum + (monthlySales.get(key) ?? 0), 0) /
    RECENT_COMPLETED_MONTHS;

  return {
    confidence: monthlySales.size === RECENT_COMPLETED_MONTHS ? "MEDIUM" : "LOW",
    demandSource: "RECENT_SALES",
    monthlyDemand,
    observedRecentMonths: monthlySales.size
  };
}

function roundedCoverageDays(sellableStock: number, monthlyDemand: number) {
  return Math.round(((sellableStock / monthlyDemand) * DAYS_PER_MONTH) * 10) / 10;
}

export function classifyStockHealth(input: ClassifyStockHealthInput): AutomaticStockHealth {
  const sellableStock = Number.isFinite(input.sellableStock)
    ? Math.max(0, input.sellableStock)
    : 0;
  const signal = resolveDemandSignal(input);

  if (sellableStock <= 0) {
    return {
      confidence: signal.confidence,
      coverageDays: 0,
      demandSource: signal.demandSource,
      monthlyDemand: signal.monthlyDemand,
      reason: "No sellable stock is available.",
      status: "OUT_OF_STOCK"
    };
  }

  if (signal.monthlyDemand === null) {
    return {
      confidence: "LOW",
      coverageDays: null,
      demandSource: "INSUFFICIENT_HISTORY",
      monthlyDemand: null,
      reason:
        "Insufficient completed sales history; holding Normal until current stock health has enough actual demand history.",
      status: "NORMAL"
    };
  }

  if (signal.monthlyDemand <= 0) {
    return {
      confidence: signal.confidence,
      coverageDays: null,
      demandSource: signal.demandSource,
      monthlyDemand: 0,
      reason: `No actual demand was recorded across the last ${RECENT_COMPLETED_MONTHS} completed months.`,
      status: "OVERSTOCK"
    };
  }

  const coverageDays = roundedCoverageDays(sellableStock, signal.monthlyDemand);

  if (coverageDays < LOW_STOCK_COVERAGE_DAYS) {
    return {
      confidence: signal.confidence,
      coverageDays,
      demandSource: signal.demandSource,
      monthlyDemand: signal.monthlyDemand,
      reason: `${coverageDays} days of sellable stock cover based on recent completed sales.`,
      status: "LOW_STOCK"
    };
  }

  if (coverageDays > OVERSTOCK_COVERAGE_DAYS) {
    return {
      confidence: signal.confidence,
      coverageDays,
      demandSource: signal.demandSource,
      monthlyDemand: signal.monthlyDemand,
      reason: `${coverageDays} days of sellable stock cover based on recent completed sales.`,
      status: "OVERSTOCK"
    };
  }

  return {
    confidence: signal.confidence,
    coverageDays,
    demandSource: signal.demandSource,
    monthlyDemand: signal.monthlyDemand,
    reason: `${coverageDays} days of sellable stock cover based on recent completed sales.`,
    status: "NORMAL"
  };
}
