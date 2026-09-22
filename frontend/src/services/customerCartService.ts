import { apiClient } from "@/services/apiClient";

export type CustomerCartEntry = {
  productId: string;
  quantity: number;
};

type CustomerCartData = {
  items: CustomerCartEntry[];
};

type CustomerCartResponse = {
  success: boolean;
  message: string;
  data?: CustomerCartData;
};

function requireCartItems(response: CustomerCartResponse): CustomerCartEntry[] {
  if (!response.success || !response.data) throw new Error(response.message);
  return response.data.items;
}

export async function fetchCustomerCart(signal?: AbortSignal) {
  const response = await apiClient.request<CustomerCartData>("/api/customer-account/cart", {
    credentials: "include",
    signal
  });
  return requireCartItems(response);
}

export async function mergeGuestCartIntoAccount(items: CustomerCartEntry[]) {
  const response = await apiClient.request<CustomerCartData>("/api/customer-account/cart/merge", {
    method: "POST",
    credentials: "include",
    json: { items }
  });
  return requireCartItems(response);
}

export async function setCustomerCartItem(productId: string, quantity: number) {
  const response = await apiClient.request<CustomerCartData>(
    `/api/customer-account/cart/items/${encodeURIComponent(productId)}`,
    {
      method: "PUT",
      credentials: "include",
      json: { quantity }
    }
  );
  return requireCartItems(response);
}

export async function removeCustomerCartItem(productId: string) {
  const response = await apiClient.request<CustomerCartData>(
    `/api/customer-account/cart/items/${encodeURIComponent(productId)}`,
    {
      method: "DELETE",
      credentials: "include"
    }
  );
  return requireCartItems(response);
}

export async function clearCustomerCart() {
  const response = await apiClient.request("/api/customer-account/cart", {
    method: "DELETE",
    credentials: "include"
  });
  if (!response.success) throw new Error(response.message);
}
