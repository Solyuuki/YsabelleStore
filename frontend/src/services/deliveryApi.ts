import { apiClient } from "@/services/apiClient";
import type {
  DeliveryListMeta,
  DeliveryTicket,
  DeliveryTicketSummary,
  DeliveryTicketView,
  DeliveryTransitionInput,
  DeliveryHandoffDraftInput
} from "@/types/delivery";
import type { StorefrontDeliveryStatus, StorefrontPaymentMethod } from "@/types/storefront";

function deliveryQuery(values: {
  page?: number;
  pageSize?: number;
  status?: StorefrontDeliveryStatus;
  view?: DeliveryTicketView;
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
    view?: DeliveryTicketView;
    paymentMethod?: StorefrontPaymentMethod;
    search?: string;
  } = {},
  signal?: AbortSignal
) {
  const search = deliveryQuery(query);
  const response = await apiClient.request<DeliveryTicketSummary[], never, DeliveryListMeta>(
    `/api/deliveries${search ? `?${search}` : ""}`,
    { signal }
  );
  if (!response.success || !response.data || !response.meta) {
    throw new Error(response.message || "Delivery ticket metadata is missing.");
  }

  return {
    items: response.data,
    meta: response.meta
  };
}

export async function getDeliveryTicket(orderId: string) {
  const response = await apiClient.request<DeliveryTicket>(
    `/api/deliveries/${encodeURIComponent(orderId)}`
  );
  if (!response.success || !response.data) {
    throw new Error(response.message || "Delivery ticket could not be loaded.");
  }
  return response.data;
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

export async function saveDeliveryHandoffDraft(orderId: string, input: DeliveryHandoffDraftInput) {
  const response = await apiClient.request<DeliveryTicket, unknown>(
    `/api/deliveries/${encodeURIComponent(orderId)}/handoff`,
    { method: "PATCH", json: input }
  );
  if (!response.success || !response.data) throw new Error(response.message || "Dispatch details could not be saved.");
  return response.data;
}
