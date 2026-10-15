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
