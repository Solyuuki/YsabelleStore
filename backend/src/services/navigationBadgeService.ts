import { CustomerDeliveryStatus, type UserRole } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { getDashboardOperations, getDashboardSummary } from "./dashboardService.js";

export type NavigationBadgeSummary = {
  dashboard: number;
  deliveries: number;
  generatedAt: string;
  inventory: number;
  receiving: number;
  reports: number;
};

export async function getNavigationBadges(
  role: UserRole,
  now = new Date()
): Promise<NavigationBadgeSummary> {
  const [summary, operations, deliveries] = await Promise.all([
    getDashboardSummary(role, now),
    role === "OWNER" ? getDashboardOperations(now) : Promise.resolve(null),
    prisma.customerOrder.count({
      where: {
        deliveryStatus: {
          notIn: [CustomerDeliveryStatus.DELIVERED, CustomerDeliveryStatus.CANCELLED]
        }
      }
    })
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
  const dashboard = operations ? operations.restock.actionableProducts : inventory;

  return {
    dashboard,
    deliveries,
    generatedAt: now.toISOString(),
    inventory,
    receiving,
    reports
  };
}
