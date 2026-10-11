import { apiClient } from "@/services/apiClient";
import type {
  PaymongoCheckoutSession,
  StorefrontCategory,
  StorefrontMerchandising,
  StorefrontOrder,
  StorefrontOrderInput,
  StorefrontPaymentStatusResult,
  StorefrontPagination,
  StorefrontProduct,
  StorefrontProductDetail,
  StorefrontProductReview,
  StorefrontProductReviews,
  StorefrontRelatedProducts,
  StorefrontReviewContext,
  StorefrontReviewInput
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
  const response = await apiClient.request<StorefrontProductDetail>(
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

export async function fetchStorefrontReviewContext(productId: string, signal?: AbortSignal) {
  const response = await apiClient.request<StorefrontReviewContext>(
    `/api/storefront/products/${encodeURIComponent(productId)}/review-context`,
    { credentials: "include", signal }
  );
  if (!response.success || !response.data) throw new Error(response.message);
  return response.data;
}

export async function saveStorefrontProductReview(productId: string, input: StorefrontReviewInput) {
  const response = await apiClient.request<StorefrontProductReview, unknown>(
    `/api/storefront/products/${encodeURIComponent(productId)}/review`,
    {
      method: "PUT",
      credentials: "include",
      json: input
    }
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

const CUSTOMER_CHECKOUT_RETRY_KEY = "ysabelle:checkout-request-v1";

/**
 * Reuse the same key after timeouts: server-side uniqueness prevents a retry
 * from placing a second order. No customer PII is stored in this key.
 */
function checkoutIdempotencyKey(input: StorefrontOrderInput) {
  const signature = JSON.stringify({
    items: [...input.items].sort((a, b) => a.productId.localeCompare(b.productId)),
    paymentMethod: input.paymentMethod
  });
  try {
    const previous = JSON.parse(sessionStorage.getItem(CUSTOMER_CHECKOUT_RETRY_KEY) || "null") as {
      signature?: string;
      key?: string;
    } | null;
    if (previous?.signature === signature && previous.key) return previous.key;
    const key = crypto.randomUUID();
    sessionStorage.setItem(CUSTOMER_CHECKOUT_RETRY_KEY, JSON.stringify({ signature, key }));
    return key;
  } catch {
    return crypto.randomUUID();
  }
}

export async function placeStorefrontOrder(input: StorefrontOrderInput) {
  const key = checkoutIdempotencyKey(input);
  const response = await apiClient.request<StorefrontOrder, unknown>("/api/storefront/orders", {
    method: "POST",
    credentials: "include",
    headers: { "Idempotency-Key": key },
    json: input
  });
  if (!response.success || !response.data) throw new Error(response.message);
  try {
    sessionStorage.removeItem(CUSTOMER_CHECKOUT_RETRY_KEY);
  } catch {
    // Session storage is an optional retry optimization.
  }
  return response.data;
}

export async function startPaymongoCheckout(orderNumber: string) {
  const response = await apiClient.request<PaymongoCheckoutSession, unknown>(
    `/api/storefront/orders/${encodeURIComponent(orderNumber)}/paymongo-checkout`,
    {
      method: "POST",
      credentials: "include"
    }
  );
  if (!response.success || !response.data) throw new Error(response.message);
  return response.data;
}

export async function fetchStorefrontPaymentStatus(orderNumber: string, signal?: AbortSignal) {
  const response = await apiClient.request<StorefrontPaymentStatusResult>(
    `/api/storefront/orders/${encodeURIComponent(orderNumber)}/payment-status`,
    {
      credentials: "include",
      signal
    }
  );
  if (!response.success || !response.data) throw new Error(response.message);
  return response.data;
}

export async function confirmCustomerDeliveryReceived(orderNumber: string) {
  const response = await apiClient.request<StorefrontOrder, unknown>(
    `/api/customer-account/orders/${encodeURIComponent(orderNumber)}/confirm-received`,
    {
      method: "POST",
      credentials: "include"
    }
  );
  if (!response.success || !response.data) throw new Error(response.message);
  return response.data;
}

export async function switchStorefrontPaymentToCod(orderNumber: string) {
  const response = await apiClient.request<StorefrontPaymentStatusResult, unknown>(
    `/api/storefront/orders/${encodeURIComponent(orderNumber)}/payment-method/cash-on-delivery`,
    {
      method: "PATCH",
      credentials: "include"
    }
  );
  if (!response.success || !response.data) throw new Error(response.message);
  return response.data;
}
