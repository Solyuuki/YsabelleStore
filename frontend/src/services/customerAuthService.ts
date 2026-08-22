import { apiClient } from "@/services/apiClient";
import type {
  Customer,
  CustomerAuthErrorPayload,
  CustomerLoginInput,
  CustomerRegisterInput
} from "@/types/customerAuth";

export class CustomerAuthRequestError extends Error {
  public readonly code?: string;

  public constructor(message: string, code?: string) {
    super(message);
    this.name = "CustomerAuthRequestError";
    this.code = code;
  }
}

type CustomerResponseData = {
  customer: Customer;
};

function customerAuthRequestOptions(options: Omit<RequestInit, "body"> & { json?: unknown } = {}) {
  return {
    ...options,
    credentials: "include" as const
  };
}

function requireCustomer(
  response: Awaited<
    ReturnType<typeof apiClient.request<CustomerResponseData, CustomerAuthErrorPayload>>
  >
) {
  if (response.success && response.data?.customer) {
    return response.data.customer;
  }

  throw new CustomerAuthRequestError(
    response.message || "Customer authentication request failed.",
    response.success ? undefined : response.error?.code
  );
}

export async function getCurrentCustomer(): Promise<Customer | null> {
  const response = await apiClient.request<CustomerResponseData, CustomerAuthErrorPayload>(
    "/api/customer-auth/me",
    customerAuthRequestOptions()
  );

  if (!response.success) {
    return null;
  }

  return response.data?.customer ?? null;
}

export async function loginCustomer(input: CustomerLoginInput): Promise<Customer> {
  const response = await apiClient.request<CustomerResponseData, CustomerAuthErrorPayload>(
    "/api/customer-auth/login",
    customerAuthRequestOptions({
      method: "POST",
      json: input
    })
  );

  return requireCustomer(response);
}

export async function registerCustomer(input: CustomerRegisterInput): Promise<Customer> {
  const response = await apiClient.request<CustomerResponseData, CustomerAuthErrorPayload>(
    "/api/customer-auth/register",
    customerAuthRequestOptions({
      method: "POST",
      json: input
    })
  );

  return requireCustomer(response);
}

export async function logoutCustomer(): Promise<void> {
  const response = await apiClient.request<undefined, CustomerAuthErrorPayload>(
    "/api/customer-auth/logout",
    customerAuthRequestOptions({ method: "POST" })
  );

  if (!response.success) {
    throw new CustomerAuthRequestError(response.message, response.error?.code);
  }
}
