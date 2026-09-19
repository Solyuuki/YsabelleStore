import { apiClient } from "@/services/apiClient";
import type { StorefrontOrder, StorefrontOrderInput } from "@/types/storefront";

export const PAYMONGO_ORDER_ACCESS_KEY = "ysabelle:last-paymongo-test-order";

export type PaymongoCheckoutResponse = {
  order: StorefrontOrder;
  checkoutUrl: string;
  accessToken: string;
};

export type PaymongoOrderStatus = {
  orderNumber: string;
  orderStatus: StorefrontOrder["status"];
  paymentMethod: "PAYMONGO_TEST";
  paymentStatus: "CREATING" | "AWAITING_PAYMENT" | "PAID" | "FAILED";
  totalAmount: string;
};

export async function startPaymongoCheckout(input: Omit<StorefrontOrderInput, "paymentMethod">) {
  const response = await apiClient.request<PaymongoCheckoutResponse>(
    "/api/storefront/paymongo/checkout",
    { method: "POST", credentials: "include", json: input }
  );
  if (!response.success || !response.data) throw new Error(response.message);
  return response.data;
}

export async function getPaymongoOrderStatus(orderId: string, accessToken: string) {
  const response = await apiClient.request<PaymongoOrderStatus>(
    `/api/storefront/paymongo/orders/${encodeURIComponent(orderId)}/status`,
    { credentials: "include", headers: { "x-paymongo-order-token": accessToken } }
  );
  if (!response.success || !response.data) throw new Error(response.message);
  return response.data;
}
