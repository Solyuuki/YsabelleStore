/** Manila-calendar restock scheduling: future-month plans never imply an order today. */
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
export const FIRST_GATED_RESTOCK_MONTH = "2026-11";

export function monthlyRestockCycle(now = new Date()) {
  const manilaDate = new Date(now.getTime() + MANILA_OFFSET_MS);
  const year = manilaDate.getUTCFullYear();
  const monthIndex = manilaDate.getUTCMonth();
  const currentMonth = year + "-" + String(monthIndex + 1).padStart(2, "0");
  const next = new Date(Date.UTC(year, monthIndex + 1, 1));
  const nextMonth = next.getUTCFullYear() + "-" + String(next.getUTCMonth() + 1).padStart(2, "0");
  return {
    currentMonth,
    nextMonth,
    nextRestockAt: new Date(next.getTime() - MANILA_OFFSET_MS).toISOString(),
    // No retroactive October batch when this rule is deployed mid-October.
    automationEnabled: currentMonth >= FIRST_GATED_RESTOCK_MONTH
  };
}
export function nextMonthlyRestockDate(now = new Date()) {
  return monthlyRestockCycle(now).nextRestockAt;
}

export type NextMonthRestockProjectionInput = {
  currentDemand: number;
  expectedNextDemand: number;
  sellableStock: number;
  incomingStock: number;
  expiryRiskQuantity: number;
  targetStockLevel: number;
  reorderLevel: number;
};

/** One canonical quantity projection for the API, Dashboard, and Reports UI. */
export function estimateNextMonthRestock(input: NextMonthRestockProjectionInput) {
  const safe = (value: number) => (Number.isFinite(value) ? Math.max(0, value) : 0);
  const currentDemand = Math.ceil(safe(input.currentDemand));
  const expectedDemand = Math.ceil(safe(input.expectedNextDemand));
  const usableStock = Math.max(
    0,
    safe(input.sellableStock) + safe(input.incomingStock) - safe(input.expiryRiskQuantity)
  );
  const projectedOpeningStock = Math.max(0, usableStock - currentDemand);
  const targetStockLevel = safe(input.targetStockLevel);
  const reorderLevel = safe(input.reorderLevel);
  const demandGap = Math.max(
    0,
    Math.ceil(targetStockLevel + expectedDemand - projectedOpeningStock)
  );
  const reorderGap =
    reorderLevel > 0 && projectedOpeningStock <= reorderLevel
      ? Math.max(0, Math.ceil(reorderLevel + 1 - projectedOpeningStock))
      : 0;

  return {
    estimatedRestock: Math.max(demandGap, reorderGap),
    expectedDemand,
    projectedOpeningStock
  };
}
