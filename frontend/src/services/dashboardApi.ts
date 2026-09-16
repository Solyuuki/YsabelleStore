import { apiClient } from "@/services/apiClient";

export type DashboardActivityBucket = {
  label: string;
  saleCount: number;
  totalAmount: string;
};

export type DashboardForecastSummary =
  | {
      access: "AVAILABLE";
      failedProducts: number;
      forecastUnits2026: number;
      generatedAt: string | null;
      totalProductsForecasted: number;
      warningProducts: number;
    }
  | {
      access: "RESTRICTED" | "UNAVAILABLE";
      failedProducts: null;
      forecastUnits2026: null;
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
export type DashboardRestockOrderStatus =
  | "DRAFT"
  | "APPROVED"
  | "AWAITING_DELIVERY"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CANCELLED";
export type DashboardRestockRecommendationSource =
  | "SARIMA"
  | "LOW_STOCK"
  | "TARGET_STOCK"
  | "MANUAL";

export type DashboardRestockAction = {
  expiryRiskQuantity: number;
  incomingStock: number;
  product: {
    id: string;
    name: string;
    sku: string;
  };
  projectedStockoutDate: string | null;
  rationale: string;
  recommendationSource: DashboardRestockRecommendationSource;
  recommendedActionDate: string | null;
  recommendedQuantity: number;
  riskLevel: DashboardRestockRisk;
  sellableStock: number;
  stockHealth: "OUT_OF_STOCK" | "LOW_STOCK" | "NORMAL" | "OVERSTOCK";
};

export type DashboardOperations = {
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
      status: DashboardRestockOrderStatus;
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

export async function fetchDashboardSummary() {
  const response = await apiClient.request<DashboardSummary, never>("/api/dashboard/summary");

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return response.data;
}

export async function fetchDashboardOperations() {
  const response = await apiClient.request<DashboardOperations, never>("/api/dashboard/operations");

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return response.data;
}
