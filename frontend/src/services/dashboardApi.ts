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

export async function fetchDashboardSummary() {
  const response = await apiClient.request<DashboardSummary, never>("/api/dashboard/summary");

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return response.data;
}
