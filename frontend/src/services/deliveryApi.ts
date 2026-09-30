import { apiClient } from "@/services/apiClient";
import type {
  DeliveryListMeta,
  DeliveryTicket,
  DeliveryTransitionInput
} from "@/types/delivery";
import type { StorefrontDeliveryStatus, StorefrontPaymentMethod } from "@/types/storefront";

function deliveryQuery(values: {
  page?: number;
  pageSize?: number;
  status?: StorefrontDeliveryStatus;
  paymentMethod?: StorefrontPaymentMethod;
  search?: string;
}) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  return params.toString();
}

export async function listDeliveryTickets(
  query: {
    page?: number;
    pageSize?: number;
    status?: StorefrontDeliveryStatus;
    paymentMethod?: StorefrontPaymentMethod;
    search?: string;
  } = {},
  signal?: AbortSignal
) {
  const search = deliveryQuery(query);
  const response = await apiClient.request<DeliveryTicket[], never, DeliveryListMeta>(
    `/api/deliveries${search ? `?${search}` : ""}`,
    { signal }
  );
  if (!response.success || !response.data) throw new Error(response.message);
  return {
    items: response.data,
    meta: response.meta
  };
}

export async function updateDeliveryStatus(orderId: string, input: DeliveryTransitionInput) {
  const response = await apiClient.request<DeliveryTicket, unknown>(
    `/api/deliveries/${encodeURIComponent(orderId)}/status`,
    {
      method: "PATCH",
      json: input
    }
  );
  if (!response.success || !response.data) throw new Error(response.message);
  return response.data;
}

export async function confirmCodCollected(orderId: string, note?: string) {
  const response = await apiClient.request<DeliveryTicket, unknown>(
    `/api/deliveries/${encodeURIComponent(orderId)}/cod-collected`,
    {
      method: "POST",
      json: note?.trim() ? { note: note.trim() } : {}
    }
  );
  if (!response.success || !response.data) throw new Error(response.message);
  return response.data;
}
