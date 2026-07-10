import { apiClient } from "@/services/apiClient";
import type {
  ForecastFilters,
  ForecastGenerationSummary,
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
  return await apiClient.request<ForecastGenerationSummary>("/api/forecasts/generate", {
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

export async function getForecastProduct(productId: string) {
  return await apiClient.request<ProductForecastDetail>(
    `/api/forecasts/products/${encodeURIComponent(productId)}`,
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
