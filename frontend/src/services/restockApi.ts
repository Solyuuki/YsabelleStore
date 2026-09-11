import { apiClient } from "@/services/apiClient";

export type RestockOrderStatus =
  | "DRAFT"
  | "APPROVED"
  | "AWAITING_DELIVERY"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CANCELLED";

export type RestockRecommendationSource = "SARIMA" | "LOW_STOCK" | "TARGET_STOCK" | "MANUAL";

export type RestockPlanningCandidate = {
  forecast: {
    batchId: string | null;
    currentMonthDemand: number | null;
    modelName: string | null;
  } | null;
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
  approvedAt: string | null;
  approvedBy?: { id: string; name: string } | null;
  createdBy?: { id: string; name: string } | null;
  lines: RestockOrderLine[];
};

type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

function buildQueryString(params: Record<string, string | number | boolean | undefined>) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") return;
    query.set(key, String(value));
  });

  return query.toString();
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
