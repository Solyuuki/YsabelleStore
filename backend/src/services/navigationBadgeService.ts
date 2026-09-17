import type { UserRole } from "@prisma/client";

import { getDashboardOperations, getDashboardSummary } from "./dashboardService.js";

export type NavigationBadgeSummary = {
  dashboard: number;
  generatedAt: string;
  inventory: number;
  receiving: number;
  reports: number;
};

export async function getNavigationBadges(
  role: UserRole,
  now = new Date()
): Promise<NavigationBadgeSummary> {
  const [summary, operations] = await Promise.all([
    getDashboardSummary(role, now),
    role === "OWNER" ? getDashboardOperations(now) : Promise.resolve(null)
  ]);

  const inventory =
    summary.inventory.lowStockItems +
    summary.inventory.outOfStockItems +
    summary.expiry.nearExpiryBatches +
    summary.expiry.expiredBatches;
  const receiving = operations
    ? operations.restock.queue.readyToReceive + operations.restock.queue.partiallyReceived
    : 0;
  const reports = operations?.restock.actionableProducts ?? 0;
  const dashboard = [inventory, receiving, reports].filter((count) => count > 0).length;

  return {
    dashboard,
    generatedAt: now.toISOString(),
    inventory,
    receiving,
    reports
  };
}
