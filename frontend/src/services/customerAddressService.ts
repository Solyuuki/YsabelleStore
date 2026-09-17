import { apiClient } from "@/services/apiClient";
import type { CustomerAddress } from "@/types/customerAddress";

type AddressResponse = { address: CustomerAddress | null };

export async function fetchCustomerAddress(signal?: AbortSignal) {
  const response = await apiClient.request<AddressResponse>("/api/customer-account/address", {
    credentials: "include",
    signal
  });
  if (!response.success || !response.data) throw new Error(response.message);
  return response.data.address;
}

export async function updateCustomerAddress(address: CustomerAddress) {
  const response = await apiClient.request<AddressResponse, unknown>(
    "/api/customer-account/address",
    {
      method: "PUT",
      credentials: "include",
      json: address
    }
  );
  if (!response.success || !response.data) throw new Error(response.message);
  return response.data.address;
}
