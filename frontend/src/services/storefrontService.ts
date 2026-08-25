import { apiClient } from "@/services/apiClient";
import type {
  StorefrontCategory,
  StorefrontMerchandising,
  StorefrontOrder,
  StorefrontOrderInput,
  StorefrontPagination,
  StorefrontProduct,
  StorefrontProductReviews,
  StorefrontRelatedProducts
} from "@/types/storefront";

function queryString(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

export async function fetchStorefrontCategories(signal?: AbortSignal) {
  const response = await apiClient.request<StorefrontCategory[]>("/api/storefront/categories", {
    signal
  });
  if (!response.success || !response.data) throw new Error(response.message);
  return response.data;
}

export async function fetchStorefrontProducts(
  query: {
    search?: string;
    category?: string;
    availability?: "all" | "in-stock" | "out-of-stock";
    page?: number;
    pageSize?: number;
  } = {},
  signal?: AbortSignal
) {
  const search = queryString(query);
  const response = await apiClient.request<StorefrontProduct[], never, StorefrontPagination>(
    `/api/storefront/products${search ? `?${search}` : ""}`,
    { signal }
  );
  if (!response.success || !response.data) throw new Error(response.message);
  return {
    items: response.data,
    meta: response.meta ?? {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 24,
      totalItems: response.data.length,
      totalPages: 1
    }
  };
}

export async function fetchStorefrontProduct(productId: string, signal?: AbortSignal) {
  const response = await apiClient.request<StorefrontProduct>(
    `/api/storefront/products/${encodeURIComponent(productId)}`,
    { signal }
  );
  if (!response.success || !response.data) throw new Error(response.message);
  return response.data;
}

export async function fetchStorefrontProductReviews(
  productId: string,
  query: { rating?: number; page?: number; pageSize?: number } = {},
  signal?: AbortSignal
) {
  const search = queryString(query);
  const response = await apiClient.request<StorefrontProductReviews>(
    `/api/storefront/products/${encodeURIComponent(productId)}/reviews${search ? `?${search}` : ""}`,
    { signal }
  );
  if (!response.success || !response.data) throw new Error(response.message);
  return response.data;
}

export async function fetchStorefrontRelatedProducts(
  productId: string,
  limit = 4,
  signal?: AbortSignal
) {
  const response = await apiClient.request<StorefrontRelatedProducts>(
    `/api/storefront/products/${encodeURIComponent(productId)}/related?limit=${limit}`,
    { signal }
  );
  if (!response.success || !response.data) throw new Error(response.message);
  return response.data;
}

export async function fetchStorefrontMerchandising(signal?: AbortSignal) {
  const response = await apiClient.request<StorefrontMerchandising>(
    "/api/storefront/merchandising",
    { signal }
  );
  if (!response.success || !response.data) throw new Error(response.message);
  return response.data;
}

export async function fetchCustomerOrders(signal?: AbortSignal) {
  const response = await apiClient.request<StorefrontOrder[]>("/api/customer-account/orders", {
    credentials: "include",
    signal
  });
  if (!response.success || !response.data) throw new Error(response.message);
  return response.data;
}

export async function placeStorefrontOrder(input: StorefrontOrderInput) {
  const response = await apiClient.request<StorefrontOrder, unknown>("/api/storefront/orders", {
    method: "POST",
    credentials: "include",
    json: input
  });
  if (!response.success || !response.data) throw new Error(response.message);
  return response.data;
}
