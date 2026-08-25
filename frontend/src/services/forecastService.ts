import { apiClient } from "@/services/apiClient";
import type {
  ForecastFilters,
  ForecastRefreshResponse,
  ForecastSummary,
  PaginatedForecastProductsResponse,
  ProductForecastDetail
} from "@/types/forecast";

const AUTH_TOKEN_KEY = "ysabellestore.authToken";

function authHeaders() {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);

  return token
    ? {
        Authorization: `Bearer ${token}`
      }
    : undefined;
}

function queryString(filters: ForecastFilters) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });

  return params.toString();
}

export async function generateForecasts(force = false) {
  return await apiClient.request<ForecastRefreshResponse>("/api/forecasts/generate", {
    headers: authHeaders(),
    json: { force },
    method: "POST"
  });
}

export async function getForecastProducts(filters: ForecastFilters) {
  return await apiClient.request<PaginatedForecastProductsResponse>(
    `/api/forecasts/products?${queryString(filters)}`,
    {
      headers: authHeaders()
    }
  );
}

export async function getForecastProductCollection(filters: ForecastFilters) {
  return await getForecastProducts(filters);
}

export async function getForecastProduct(productId: string, batchId?: string | null) {
  const params = new URLSearchParams();
  if (batchId) params.set("batchId", batchId);
  const query = params.size ? `?${params.toString()}` : "";
  return await apiClient.request<ProductForecastDetail>(
    `/api/forecasts/products/${encodeURIComponent(productId)}${query}`,
    {
      headers: authHeaders()
    }
  );
}

export async function getForecastSummary() {
  return await apiClient.request<ForecastSummary>("/api/forecasts/summary", {
    headers: authHeaders()
  });
}
