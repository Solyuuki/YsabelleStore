import { apiClient } from "@/services/apiClient";

export type DashboardActivityBucket = {
  label: string;
  saleCount: number;
  totalAmount: string;
};

export type DashboardSalesCalendarDay = {
  actualAmount: string;
  completedSales: number;
  date: string;
  status: "PAST" | "TODAY" | "FUTURE";
  targetAmount: string | null;
  unitsSold: number;
};

export type DashboardSalesDayDetail = DashboardSalesCalendarDay & {
  activity: DashboardActivityBucket[];
};

export type DashboardSalesCalendar = {
  days: DashboardSalesCalendarDay[];
  generatedAt: string;
  month: string;
  summary: {
    actualAmount: string;
    completedSales: number;
    forecastAmount: string | null;
    forecastUnits: number | null;
    targetAmount: string | null;
    targetDays: number;
    unitsSold: number;
  };
  timeZone: "Asia/Manila";
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

export type NavigationBadgeSummary = {
  dashboard: number;
  generatedAt: string;
  inventory: number;
  receiving: number;
  reports: number;
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

export async function fetchNavigationBadges() {
  const response = await apiClient.request<NavigationBadgeSummary, never>(
    "/api/dashboard/navigation-badges"
  );

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return response.data;
}


export async function fetchDashboardSalesCalendar(month: string) {
  const response = await apiClient.request<DashboardSalesCalendar, never>(
    `/api/dashboard/sales-calendar?month=${encodeURIComponent(month)}`
  );

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return response.data;
}

export async function fetchDashboardSalesDay(date: string) {
  const response = await apiClient.request<DashboardSalesDayDetail, never>(
    `/api/dashboard/sales-calendar/day?date=${encodeURIComponent(date)}`
  );

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return response.data;
}

export async function saveDashboardSalesTarget(date: string, targetAmount: number | null) {
  const response = await apiClient.request<{ date: string; targetAmount: string | null }, never>(
    `/api/dashboard/sales-calendar/targets/${encodeURIComponent(date)}`,
    {
      json: { targetAmount },
      method: "PUT"
    }
  );

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return response.data;
}
