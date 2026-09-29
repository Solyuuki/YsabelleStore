import {
  Prisma,
  RestockOrderStatus,
  type RestockRecommendationSource,
  type UserRole
} from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { getForecastSummary } from "../modules/forecasting/forecast.service.js";
import { listRestockPlanningCandidates } from "./restockPlanningService.js";
import {
  buildRecommenderAssistant,
  type RecommenderAssistantResult
} from "./recommenderAiService.js";

const MANILA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const SALES_BUCKET_HOURS = 2;
const SALES_BUCKET_MS = SALES_BUCKET_HOURS * 60 * 60 * 1000;
const SALES_BUCKET_COUNT = 24 / SALES_BUCKET_HOURS;
const NEAR_EXPIRY_WINDOW_DAYS = 30;
const DASHBOARD_ACTION_LIMIT = 5;
const DASHBOARD_PLANNING_PAGE_SIZE = 1_000;
const OPEN_RESTOCK_STATUSES = [
  RestockOrderStatus.DRAFT,
  RestockOrderStatus.APPROVED,
  RestockOrderStatus.AWAITING_DELIVERY,
  RestockOrderStatus.PARTIALLY_RECEIVED
] as const;

export type DashboardActivityBucket = {
  label: string;
  saleCount: number;
  totalAmount: string;
};

export type DashboardForecastSummary =
  | {
      access: "AVAILABLE";
      failedProducts: number;
      forecastHorizonMonths: number;
      forecastHorizonTotal: number;
      generatedAt: string | null;
      totalProductsForecasted: number;
      warningProducts: number;
    }
  | {
      access: "RESTRICTED" | "UNAVAILABLE";
      failedProducts: null;
      forecastHorizonMonths: null;
      forecastHorizonTotal: null;
      generatedAt: null;
      totalProductsForecasted: null;
      warningProducts: null;
    };

export type DashboardSummary = {
  generatedAt: string;
  sales: {
    activity: DashboardActivityBucket[];
    completedSales: number;
    todayAmount: string;
  };
  inventory: {
    availableItems: number;
    catalogItems: number;
    inStockItems: number;
    lowStockItems: number;
    outOfStockItems: number;
    trackedItems: number;
    unavailableItems: number;
    unlinkedCatalogItems: number;
  };
  expiry: {
    expiredBatches: number;
    nearExpiryBatches: number;
    windowDays: number;
  };
  forecast: DashboardForecastSummary;
};

export type DashboardRestockRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type DashboardRecommendationAction = "RESTOCK" | "REDUCE_REPLENISHMENT" | "EXPIRY_REVIEW";

export type DashboardRestockAction = {
  actionType: DashboardRecommendationAction;
  expiryRiskQuantity: number;
  incomingStock: number;
  product: {
    id: string;
    name: string;
    sku: string;
  };
  projectedStockoutDate: string | null;
  rationale: string;
  recommendationSource: RestockRecommendationSource;
  recommendedActionDate: string | null;
  recommendedQuantity: number;
  riskLevel: DashboardRestockRisk;
  sellableStock: number;
  stockHealth: "OUT_OF_STOCK" | "LOW_STOCK" | "NORMAL" | "OVERSTOCK";
};

export type DashboardOperations = {
  assistant: RecommenderAssistantResult;
  generatedAt: string;
  restock: {
    actionableProducts: number;
    actions: DashboardRestockAction[];
    latestOpenOrder: {
      automated: boolean;
      id: string;
      orderNumber: string;
      productLines: number;
      receivedUnits: number;
      remainingUnits: number;
      requestedUnits: number;
      status: RestockOrderStatus;
      updatedAt: string;
    } | null;
    queue: {
      approved: number;
      awaitingDelivery: number;
      draft: number;
      partiallyReceived: number;
      readyToReceive: number;
      totalOpen: number;
    };
    risk: Record<DashboardRestockRisk, number>;
    suggestedUnits: number;
  };
};

export async function getDashboardSummary(
  role: UserRole,
  now = new Date()
): Promise<DashboardSummary> {
  const { end: dayEnd, start: dayStart } = getManilaDayRange(now);
  const nearExpiryEnd = new Date(now.getTime() + NEAR_EXPIRY_WINDOW_DAYS * DAY_MS);

  const [
    todaySales,
    inventoryRows,
    catalogItems,
    availableItems,
    nearExpiryBatches,
    expiredBatches,
    forecast
  ] = await Promise.all([
    prisma.sale.findMany({
      where: {
        status: "COMPLETED",
        saleDate: {
          gte: dayStart,
          lt: dayEnd
        }
      },
      select: {
        saleDate: true,
        totalAmount: true
      }
    }),
    prisma.inventory.findMany({
      where: {
        product: {
          recordSource: { not: "TEST_FIXTURE" }
        }
      },
      select: {
        quantityOnHand: true,
        product: {
          select: {
            reorderLevel: true,
            status: true
          }
        }
      }
    }),
    prisma.product.count({
      where: {
        recordSource: { not: "TEST_FIXTURE" }
      }
    }),
    prisma.product.count({
      where: {
        recordSource: { not: "TEST_FIXTURE" },
        status: "ACTIVE"
      }
    }),
    prisma.inventoryBatch.count({
      where: {
        product: {
          recordSource: { not: "TEST_FIXTURE" },
          status: "ACTIVE"
        },
        quantityRemaining: { gt: 0 },
        expiresAt: {
          gte: now,
          lt: nearExpiryEnd
        },
        status: {
          in: ["AVAILABLE", "LOW_STOCK"]
        }
      }
    }),
    prisma.inventoryBatch.count({
      where: {
        product: {
          recordSource: { not: "TEST_FIXTURE" },
          status: "ACTIVE"
        },
        quantityRemaining: { gt: 0 },
        expiresAt: { lt: now },
        status: {
          notIn: ["DEPLETED", "REMOVED"]
        }
      }
    }),
    getDashboardForecast(role)
  ]);

  const activityTotals = Array.from({ length: SALES_BUCKET_COUNT }, () => new Prisma.Decimal(0));
  const activityCounts = Array.from({ length: SALES_BUCKET_COUNT }, () => 0);
  let todayAmount = new Prisma.Decimal(0);

  for (const sale of todaySales) {
    todayAmount = todayAmount.add(sale.totalAmount);
    const bucketIndex = Math.min(
      SALES_BUCKET_COUNT - 1,
      Math.max(0, Math.floor((sale.saleDate.getTime() - dayStart.getTime()) / SALES_BUCKET_MS))
    );

    activityTotals[bucketIndex] = activityTotals[bucketIndex]!.add(sale.totalAmount);
    activityCounts[bucketIndex] = (activityCounts[bucketIndex] ?? 0) + 1;
  }

  let lowStockItems = 0;
  let outOfStockItems = 0;
  let inStockItems = 0;

  for (const inventory of inventoryRows) {
    if (inventory.product.status !== "ACTIVE") {
      continue;
    }

    if (inventory.quantityOnHand <= 0) {
      outOfStockItems += 1;
    } else if (inventory.quantityOnHand <= inventory.product.reorderLevel) {
      lowStockItems += 1;
    } else {
      inStockItems += 1;
    }
  }

  const trackedItems = inventoryRows.length;

  return {
    generatedAt: now.toISOString(),
    sales: {
      activity: activityTotals.map((total, index) => ({
        label: formatBucketLabel(index),
        saleCount: activityCounts[index] ?? 0,
        totalAmount: total.toFixed(2)
      })),
      completedSales: todaySales.length,
      todayAmount: todayAmount.toFixed(2)
    },
    inventory: {
      availableItems,
      catalogItems,
      inStockItems,
      lowStockItems,
      outOfStockItems,
      trackedItems,
      unavailableItems: Math.max(0, catalogItems - availableItems),
      unlinkedCatalogItems: Math.max(0, catalogItems - trackedItems)
    },
    expiry: {
      expiredBatches,
      nearExpiryBatches,
      windowDays: NEAR_EXPIRY_WINDOW_DAYS
    },
    forecast
  };
}

export async function getDashboardOperations(now = new Date()): Promise<DashboardOperations> {
  const [
    planning,
    draftCount,
    approvedCount,
    awaitingDeliveryCount,
    partiallyReceivedCount,
    latestOpenOrder
  ] = await Promise.all([
    listRestockPlanningCandidates({
      includeZero: true,
      page: 1,
      pageSize: DASHBOARD_PLANNING_PAGE_SIZE
    }),
    prisma.restockOrder.count({ where: { status: RestockOrderStatus.DRAFT } }),
    prisma.restockOrder.count({ where: { status: RestockOrderStatus.APPROVED } }),
    prisma.restockOrder.count({ where: { status: RestockOrderStatus.AWAITING_DELIVERY } }),
    prisma.restockOrder.count({ where: { status: RestockOrderStatus.PARTIALLY_RECEIVED } }),
    prisma.restockOrder.findFirst({
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        lines: {
          select: {
            isSelected: true,
            receivedQuantity: true,
            requestedQuantity: true
          }
        },
        notes: true,
        orderNumber: true,
        status: true,
        updatedAt: true
      },
      where: {
        status: { in: [...OPEN_RESTOCK_STATUSES] }
      }
    })
  ]);

  const riskCounts: Record<DashboardRestockRisk, number> = {
    CRITICAL: 0,
    HIGH: 0,
    LOW: 0,
    MEDIUM: 0
  };
  const riskPriority: Record<DashboardRestockRisk, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3
  };
  const stockHealthPriority: Record<DashboardRestockAction["stockHealth"], number> = {
    OUT_OF_STOCK: 0,
    LOW_STOCK: 1,
    NORMAL: 2,
    OVERSTOCK: 3
  };

  const actions = planning.items
    .filter(
      (candidate) =>
        candidate.recommendedQuantity > 0 ||
        candidate.stockHealth.status === "OVERSTOCK" ||
        candidate.expiryRiskQuantity > 0
    )
    .map((candidate): DashboardRestockAction => {
      const actionType: DashboardRecommendationAction =
        candidate.recommendedQuantity > 0
          ? "RESTOCK"
          : candidate.expiryRiskQuantity > 0
            ? "EXPIRY_REVIEW"
            : "REDUCE_REPLENISHMENT";
      const riskLevel: DashboardRestockRisk =
        actionType === "EXPIRY_REVIEW"
          ? "HIGH"
          : actionType === "REDUCE_REPLENISHMENT"
            ? "MEDIUM"
            : (candidate.forecastDecision?.riskLevel ?? "LOW");
      riskCounts[riskLevel] += 1;
      const rationale =
        actionType === "REDUCE_REPLENISHMENT"
          ? `${candidate.stockHealth.reason} Reduce or pause the next replenishment until stock coverage returns to the normal range.`
          : actionType === "EXPIRY_REVIEW"
            ? `${candidate.expiryRiskQuantity.toLocaleString()} sellable unit(s) are within the near-expiry window. Review existing stock before adding more supply.`
            : candidate.rationale;

      return {
        actionType,
        expiryRiskQuantity: candidate.expiryRiskQuantity,
        incomingStock: candidate.incomingStock,
        product: {
          id: candidate.product.id,
          name: candidate.product.name,
          sku: candidate.product.sku
        },
        projectedStockoutDate: candidate.forecastDecision?.projectedStockoutDate ?? null,
        rationale,
        recommendationSource: candidate.recommendationSource,
        recommendedActionDate: candidate.forecastDecision?.recommendedActionDate ?? null,
        recommendedQuantity: candidate.recommendedQuantity,
        riskLevel,
        sellableStock: candidate.sellableStock,
        stockHealth: candidate.stockHealth.status
      };
    });

  actions.sort((left, right) => {
    const riskDifference = riskPriority[left.riskLevel] - riskPriority[right.riskLevel];
    if (riskDifference !== 0) return riskDifference;

    const healthDifference =
      stockHealthPriority[left.stockHealth] - stockHealthPriority[right.stockHealth];
    if (healthDifference !== 0) return healthDifference;

    const quantityDifference = right.recommendedQuantity - left.recommendedQuantity;
    if (quantityDifference !== 0) return quantityDifference;

    return left.product.name.localeCompare(right.product.name);
  });

  const selectedLatestLines = latestOpenOrder?.lines.filter((line) => line.isSelected) ?? [];
  const requestedUnits = selectedLatestLines.reduce(
    (sum, line) => sum + Math.max(0, line.requestedQuantity),
    0
  );
  const receivedUnits = selectedLatestLines.reduce(
    (sum, line) => sum + Math.max(0, line.receivedQuantity),
    0
  );
  const totalOpen = draftCount + approvedCount + awaitingDeliveryCount + partiallyReceivedCount;
  const visibleActions = actions.slice(0, DASHBOARD_ACTION_LIMIT);
  const assistant = await buildRecommenderAssistant(
    visibleActions.map((action) => ({
      actionType: action.actionType,
      expiryRiskQuantity: action.expiryRiskQuantity,
      incomingStock: action.incomingStock,
      productName: action.product.name,
      rationale: action.rationale,
      recommendationSource: action.recommendationSource,
      recommendedQuantity: action.recommendedQuantity,
      riskLevel: action.riskLevel,
      sellableStock: action.sellableStock,
      sku: action.product.sku
    }))
  );

  return {
    assistant,
    generatedAt: now.toISOString(),
    restock: {
      actionableProducts: actions.length,
      actions: visibleActions,
      latestOpenOrder: latestOpenOrder
        ? {
            automated:
              latestOpenOrder.notes?.includes("[AutomatedRestockMonth:") === true ||
              latestOpenOrder.notes?.includes("[AutomatedRestock:") === true,
            id: latestOpenOrder.id,
            orderNumber: latestOpenOrder.orderNumber,
            productLines: selectedLatestLines.length,
            receivedUnits,
            remainingUnits: Math.max(0, requestedUnits - receivedUnits),
            requestedUnits,
            status: latestOpenOrder.status,
            updatedAt: latestOpenOrder.updatedAt.toISOString()
          }
        : null,
      queue: {
        approved: approvedCount,
        awaitingDelivery: awaitingDeliveryCount,
        draft: draftCount,
        partiallyReceived: partiallyReceivedCount,
        readyToReceive: approvedCount + awaitingDeliveryCount,
        totalOpen
      },
      risk: riskCounts,
      suggestedUnits: actions.reduce(
        (sum, action) => sum + Math.max(0, action.recommendedQuantity),
        0
      )
    }
  };
}

export function getManilaDayRange(now: Date): { end: Date; start: Date } {
  const manilaNow = new Date(now.getTime() + MANILA_UTC_OFFSET_MS);
  const manilaMidnightAsUtc = Date.UTC(
    manilaNow.getUTCFullYear(),
    manilaNow.getUTCMonth(),
    manilaNow.getUTCDate()
  );
  const start = new Date(manilaMidnightAsUtc - MANILA_UTC_OFFSET_MS);

  return {
    start,
    end: new Date(start.getTime() + DAY_MS)
  };
}

function formatBucketLabel(index: number) {
  const startHour = index * SALES_BUCKET_HOURS;
  const endHour = (startHour + SALES_BUCKET_HOURS) % 24;

  return `${formatHour(startHour)}–${formatHour(endHour)}`;
}

function formatHour(hour: number) {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour < 12) return `${hour} AM`;

  return `${hour - 12} PM`;
}

async function getDashboardForecast(role: UserRole): Promise<DashboardForecastSummary> {
  if (role !== "OWNER") {
    return {
      access: "RESTRICTED",
      failedProducts: null,
      forecastHorizonMonths: null,
      forecastHorizonTotal: null,
      generatedAt: null,
      totalProductsForecasted: null,
      warningProducts: null
    };
  }

  try {
    const summary = await getForecastSummary();

    return {
      access: "AVAILABLE",
      failedProducts: summary.failedProducts,
      forecastHorizonMonths: summary.forecastPeriod.months,
      forecastHorizonTotal: summary.forecastPeriod.forecastUnits,
      generatedAt: summary.generatedAt,
      totalProductsForecasted: summary.totalProductsForecasted,
      warningProducts: summary.warningProducts
    };
  } catch {
    return {
      access: "UNAVAILABLE",
      failedProducts: null,
      forecastHorizonMonths: null,
      forecastHorizonTotal: null,
      generatedAt: null,
      totalProductsForecasted: null,
      warningProducts: null
    };
  }
}
