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

export async function checkoutPosSale(
  input: PosCheckoutRequest
): Promise<ApiResponse<PosCheckoutResponse, PosErrorPayload>> {
  return apiClient.request<PosCheckoutResponse, PosErrorPayload>("/api/pos/checkout", {
    headers: getAuthHeaders(),
    method: "POST",
    json: input
  });
}

export async function listRecentSales(
  limit = 20
): Promise<ApiResponse<PosSalesListResponse, PosErrorPayload>> {
  return apiClient.request<PosSalesListResponse, PosErrorPayload>(`/api/sales?limit=${limit}`, {
    headers: getAuthHeaders()
  });
}
