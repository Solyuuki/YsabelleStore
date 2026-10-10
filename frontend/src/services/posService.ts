import { apiClient } from "@/services/apiClient";
import type { ApiResponse } from "@/types/api";
import type {
  PosCheckoutRequest,
  PosCheckoutResponse,
  PosProductSearchResponse,
  PosSalesListResponse
} from "@/types/pos";

type PosErrorPayload = {
  code?: string;
  details?: unknown;
};

const AUTH_TOKEN_KEY = "ysabellestore.authToken";

function getAuthHeaders() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);

  return token
    ? {
        Authorization: `Bearer ${token}`
      }
    : undefined;
}

export async function searchPosProducts(
  query: string,
  options: { page?: number; pageSize?: number; signal?: AbortSignal } = {}
): Promise<ApiResponse<PosProductSearchResponse, PosErrorPayload>> {
  const searchParams = new URLSearchParams();

  if (query.trim()) {
    searchParams.set("q", query.trim());
  }

  if (options.page) {
    searchParams.set("page", String(options.page));
  }

  if (options.pageSize) {
    searchParams.set("pageSize", String(options.pageSize));
  }

  const suffix = searchParams.toString() ? `?${searchParams.toString()}` : "";

  return apiClient.request<PosProductSearchResponse, PosErrorPayload>(`/api/products${suffix}`, {
    headers: getAuthHeaders(),
    signal: options.signal
  });
}

const POS_CHECKOUT_RETRY_KEY = "ysabelle:pos-checkout-request-v1";

function checkoutIdempotencyKey(input: PosCheckoutRequest) {
  const signature = JSON.stringify({
    cashReceived: input.cashReceived,
    items: [...input.items].sort((a, b) => a.productId.localeCompare(b.productId)),
    notes: input.notes ?? ""
  });
  try {
    const previous = JSON.parse(sessionStorage.getItem(POS_CHECKOUT_RETRY_KEY) || "null") as {
      signature?: string;
      key?: string;
    } | null;
    if (previous?.signature === signature && previous.key) return previous.key;
    const key = crypto.randomUUID();
    sessionStorage.setItem(POS_CHECKOUT_RETRY_KEY, JSON.stringify({ signature, key }));
    return key;
  } catch {
    return crypto.randomUUID();
  }
}

export async function checkoutPosSale(
  input: PosCheckoutRequest
): Promise<ApiResponse<PosCheckoutResponse, PosErrorPayload>> {
  const key = checkoutIdempotencyKey(input);
  const response = await apiClient.request<PosCheckoutResponse, PosErrorPayload>(
    "/api/pos/checkout",
    {
      headers: { ...getAuthHeaders(), "Idempotency-Key": key },
      method: "POST",
      json: input
    }
  );
  if (response.success) {
    try {
      sessionStorage.removeItem(POS_CHECKOUT_RETRY_KEY);
    } catch {
      // Storage may be disabled; backend still deduplicates requests with keys.
    }
  }
  return response;
}

export async function listRecentSales(
  limit = 20
): Promise<ApiResponse<PosSalesListResponse, PosErrorPayload>> {
  return apiClient.request<PosSalesListResponse, PosErrorPayload>(`/api/sales?limit=${limit}`, {
    headers: getAuthHeaders()
  });
}
