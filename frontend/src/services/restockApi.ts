import { apiClient } from "@/services/apiClient";

export type RestockOrderStatus =
  | "DRAFT"
  | "APPROVED"
  | "AWAITING_DELIVERY"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CANCELLED";

export type RestockRecommendationSource = "SARIMA" | "LOW_STOCK" | "TARGET_STOCK" | "MANUAL";
export type RestockForecastRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type StockHealthStatus = "OUT_OF_STOCK" | "LOW_STOCK" | "NORMAL" | "OVERSTOCK";
export type StockHealthDemandSource = "RECENT_SALES" | "INSUFFICIENT_HISTORY";
export type StockHealthConfidence = "HIGH" | "MEDIUM" | "LOW";

export type AutomaticStockHealth = {
  status: StockHealthStatus;
  coverageDays: number | null;
  monthlyDemand: number | null;
  demandSource: StockHealthDemandSource;
  confidence: StockHealthConfidence;
  reason: string;
};

export type RestockForecastPoint = {
  period: string;
  predictedQuantity: number;
  lowerConfidence: number | null;
  upperConfidence: number | null;
};

export type RestockHistoricalPoint = {
  period: string;
  quantitySold: number;
};

export type RestockForecastDecision = {
  currentMonthDemand: number;
  confidenceAdjustedDemand: number;
  projectedEndingStock: number;
  projectedStockoutDate: string | null;
  suggestedQuantity: number;
  riskLevel: RestockForecastRisk;
  recommendedActionDate: string | null;
  reason: string;
};

export type RestockPlanningCandidate = {
  expiryRiskQuantity: number;
  forecast: {
    batchId: string | null;
    currentMonthDemand: number | null;
    generatedAt: string | null;
    historical: RestockHistoricalPoint[];
    modelName: string | null;
    points: RestockForecastPoint[];
  } | null;
  forecastDecision: RestockForecastDecision | null;
  incomingStock: number;
  physicalOnHand: number;
  product: {
    barcode: string | null;
    id: string;
    name: string;
    reorderLevel: number;
    sku: string;
    targetStockLevel: number;
  };
  quarantinedStock: number;
  rationale: string;
  recommendationId: string | null;
  recommendationSource: Exclude<RestockRecommendationSource, "MANUAL">;
  recommendedQuantity: number;
  sellableStock: number;
  stockHealth: AutomaticStockHealth;
};

export type RestockDraftLineInput = {
  productId: string;
  recommendationId?: string | null;
  recommendationSource: RestockRecommendationSource;
  recommendedQuantity: number;
  requestedQuantity: number;
  isSelected: boolean;
  ownerOverrideReason?: string | null;
  notes?: string | null;
};

export type RestockOrderLine = RestockDraftLineInput & {
  id: string;
  receivedQuantity: number;
  product: {
    barcode: string | null;
    id: string;
    name: string;
    reorderLevel: number;
    sku: string;
    status: "ACTIVE" | "INACTIVE" | "DISCONTINUED";
    targetStockLevel: number;
  };
  recommendation?: {
    id: string;
    reason: string;
    status: string;
    type: string;
  } | null;
};

export type RestockOrder = {
  id: string;
  orderNumber: string;
  status: RestockOrderStatus;
  version: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  approvedBy?: { id: string; name: string } | null;
  createdBy?: { id: string; name: string } | null;
  lines: RestockOrderLine[];
};

export type RestockReceiptLineInput = {
  lineId: string;
  deliveredQuantity: number;
  damagedQuantity: number;
  damageReason?: string | null;
  acceptedQuantity: number;
  batchCode?: string | null;
  expiresAt?: string | null;
  noExpiration: boolean;
  scannedBarcode?: string | null;
  confirmNewBarcode?: boolean;
  confirmOverDelivery?: boolean;
  unitCost?: number;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

type QueryValue = string | number | boolean | readonly string[] | undefined;

const LOCAL_RESTOCK_QA_COVERAGE_DAYS: Record<string, number> = {
  "SARIMA-P266": 24,
  "SARIMA-P121": 20,
  "SARIMA-P013": 16,
  "SARIMA-P087": 12,
  "SARIMA-P085": 28
};

function buildQueryString(params: Record<string, QueryValue>) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") return;
    if (Array.isArray(value)) {
      if (value.length > 0) query.set(key, value.join(","));
      return;
    }
    query.set(key, String(value));
  });

  return query.toString();
}

function isLocalRestockQaEnabled() {
  if (typeof window === "undefined") return false;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

function monthPeriod(date: Date, monthOffset: number) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthOffset, 1)
  ).toISOString();
}

function dateAfterDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000).toISOString();
}

function buildLocalQaCandidate(
  candidate: RestockPlanningCandidate,
  coverageDays: number
): RestockPlanningCandidate {
  const now = new Date();
  const effectiveStock = Math.max(
    0,
    candidate.sellableStock + candidate.incomingStock - candidate.expiryRiskQuantity
  );
  const monthlyDemand = Math.max(1, Math.ceil((Math.max(1, effectiveStock) / coverageDays) * 30));
  const confidenceAdjustedDemand = Math.ceil(monthlyDemand * 1.15);
  const suggestedQuantity = Math.max(1, Math.ceil(monthlyDemand * 1.5 - effectiveStock));
  const riskLevel: RestockForecastRisk =
    coverageDays <= 7
      ? "CRITICAL"
      : coverageDays <= 14
        ? "HIGH"
        : coverageDays <= 30
          ? "MEDIUM"
          : "LOW";
  const actionLeadDays =
    riskLevel === "HIGH" || riskLevel === "CRITICAL" ? 0 : Math.max(0, coverageDays - 14);
  const historicalFactors = [0.78, 0.84, 0.9, 0.95, 1, 1.05];
  const forecastFactors = [1, 1.04, 0.98, 1.08, 1.12, 1.15];
  const historical = historicalFactors.map((factor, index) => ({
    period: monthPeriod(now, index - historicalFactors.length),
    quantitySold: Math.max(1, Math.round(monthlyDemand * factor))
  }));
  const points = forecastFactors.map((factor, index) => {
    const predictedQuantity = Math.max(1, Math.round(monthlyDemand * factor));
    return {
      period: monthPeriod(now, index),
      predictedQuantity,
      lowerConfidence: Math.max(0, Math.round(predictedQuantity * 0.85 * 10) / 10),
      upperConfidence: Math.round(predictedQuantity * 1.15 * 10) / 10
    };
  });
  const reason = `Temporary local QA scenario: ${coverageDays} days of stock cover at about ${monthlyDemand} units/month; restore toward 45 days of healthy coverage.`;

  return {
    ...candidate,
    forecast: {
      batchId: null,
      currentMonthDemand: monthlyDemand,
      generatedAt: now.toISOString(),
      historical,
      modelName: "SARIMAX QA",
      points
    },
    forecastDecision: {
      currentMonthDemand: monthlyDemand,
      confidenceAdjustedDemand,
      projectedEndingStock: effectiveStock - confidenceAdjustedDemand,
      projectedStockoutDate: dateAfterDays(now, coverageDays),
      suggestedQuantity,
      riskLevel,
      recommendedActionDate: dateAfterDays(now, actionLeadDays),
      reason
    },
    rationale: reason,
    recommendationId: null,
    recommendationSource: "SARIMA",
    recommendedQuantity: suggestedQuantity,
    stockHealth: {
      status: effectiveStock <= 0 ? "OUT_OF_STOCK" : "LOW_STOCK",
      coverageDays: effectiveStock <= 0 ? 0 : coverageDays,
      monthlyDemand,
      demandSource: "RECENT_SALES",
      confidence: "MEDIUM",
      reason
    }
  };
}

function applyLocalRestockQaScenario(items: RestockPlanningCandidate[]) {
  if (!isLocalRestockQaEnabled()) return items;

  return items.map((candidate) => {
    const coverageDays = LOCAL_RESTOCK_QA_COVERAGE_DAYS[candidate.product.sku];
    return coverageDays ? buildLocalQaCandidate(candidate, coverageDays) : candidate;
  });
}

export async function listRestockPlanning(
  query: {
    search?: string;
    includeZero?: boolean;
    page?: number;
    pageSize?: number;
  } = {},
  options: Pick<RequestInit, "signal"> = {}
): Promise<{ items: RestockPlanningCandidate[]; meta: PaginationMeta }> {
  const queryString = buildQueryString(query);
  const response = await apiClient.request<
    RestockPlanningCandidate[],
    { code?: string },
    PaginationMeta
  >(`/api/restock-orders/planning${queryString ? `?${queryString}` : ""}`, options);

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return {
    items: applyLocalRestockQaScenario(response.data),
    meta: response.meta ?? {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      totalItems: response.data.length,
      totalPages: 1
    }
  };
}

export async function listRestockOrders(
  query: {
    search?: string;
    status?: RestockOrderStatus;
    statuses?: readonly RestockOrderStatus[];
    hasReturns?: boolean;
    page?: number;
    pageSize?: number;
  } = {},
  options: Pick<RequestInit, "signal"> = {}
): Promise<{ items: RestockOrder[]; meta: PaginationMeta }> {
  const queryString = buildQueryString(query);
  const response = await apiClient.request<RestockOrder[], { code?: string }, PaginationMeta>(
    `/api/restock-orders${queryString ? `?${queryString}` : ""}`,
    options
  );

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return {
    items: response.data,
    meta: response.meta ?? {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
      totalItems: response.data.length,
      totalPages: 1
    }
  };
}

export async function dismissRestockRecommendation(recommendationId: string, reason: string) {
  const response = await apiClient.request<
    { id: string; resolvedAt: string; status: "DISMISSED" },
    { code?: string }
  >(`/api/restock-orders/recommendations/${encodeURIComponent(recommendationId)}/dismiss`, {
    method: "POST",
    json: { reason }
  });

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return response.data;
}

export async function createRestockOrder(input: {
  notes?: string | null;
  lines: RestockDraftLineInput[];
}) {
  const response = await apiClient.request<RestockOrder, { code?: string; details?: unknown }>(
    "/api/restock-orders",
    {
      method: "POST",
      json: input
    }
  );

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return response.data;
}

export async function createRestockRequest(input: {
  notes?: string | null;
  lines: RestockDraftLineInput[];
}) {
  const response = await apiClient.request<RestockOrder, { code?: string; details?: unknown }>(
    "/api/restock-orders/requests",
    {
      method: "POST",
      json: input
    }
  );

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return response.data;
}

export async function replaceRestockOrderLines(
  orderId: string,
  input: { expectedVersion: number; lines: RestockDraftLineInput[] }
) {
  const response = await apiClient.request<RestockOrder, { code?: string; details?: unknown }>(
    `/api/restock-orders/${encodeURIComponent(orderId)}/lines`,
    {
      method: "PUT",
      json: input
    }
  );

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return response.data;
}

export async function approveRestockOrder(orderId: string, expectedVersion: number) {
  const response = await apiClient.request<RestockOrder, { code?: string; details?: unknown }>(
    `/api/restock-orders/${encodeURIComponent(orderId)}/approve`,
    {
      method: "POST",
      json: { expectedVersion }
    }
  );

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return response.data;
}

export async function markRestockOrderAwaitingDelivery(orderId: string, expectedVersion: number) {
  const response = await apiClient.request<RestockOrder, { code?: string; details?: unknown }>(
    `/api/restock-orders/${encodeURIComponent(orderId)}/await-delivery`,
    {
      method: "POST",
      json: { expectedVersion }
    }
  );

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return response.data;
}

export async function cancelRestockOrder(
  orderId: string,
  input: { expectedVersion: number; reason: string }
) {
  const response = await apiClient.request<RestockOrder, { code?: string; details?: unknown }>(
    `/api/restock-orders/${encodeURIComponent(orderId)}/cancel`,
    {
      method: "POST",
      json: input
    }
  );

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return response.data;
}

export async function receiveRestockOrder(
  orderId: string,
  input: { expectedVersion: number; lines: RestockReceiptLineInput[] }
) {
  const response = await apiClient.request<RestockOrder, { code?: string; details?: unknown }>(
    `/api/restock-orders/${encodeURIComponent(orderId)}/receipts`,
    {
      method: "POST",
      json: input
    }
  );

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return response.data;
}

export async function saveRestockReturnReport(
  orderId: string,
  input: { expectedVersion: number; supplierName: string; deliveryReference?: string | null }
) {
  const response = await apiClient.request<RestockOrder, { code?: string; details?: unknown }>(
    `/api/restock-orders/${encodeURIComponent(orderId)}/return-report`,
    {
      method: "PATCH",
      json: input
    }
  );

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return response.data;
}
