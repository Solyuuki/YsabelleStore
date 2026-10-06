import { apiClient } from "@/services/apiClient";
import type { CustomerAuthErrorPayload } from "@/types/customerAuth";
import type { StorefrontFavoriteProduct } from "@/types/storefront";
import type {
  CustomerAccountCustomerResponse,
  CustomerPasswordChangeInput,
  CustomerProfileUpdateInput,
  CustomerSecuritySummary,
  CustomerSessionRevocationResponse,
  CustomerSessionsResponse,
  CustomerUsernameClaimInput
} from "@/types/customerAccount";

export class CustomerAccountRequestError extends Error {
  public readonly code?: string;

  public constructor(message: string, code?: string) {
    super(message);
    this.name = "CustomerAccountRequestError";
    this.code = code;
  }
}

function requestOptions(options: Omit<RequestInit, "body"> & { json?: unknown } = {}) {
  return {
    ...options,
    credentials: "include" as const
  };
}

async function request<TData>(
  path: string,
  options: Omit<RequestInit, "body"> & { json?: unknown } = {}
): Promise<TData> {
  const response = await apiClient.request<TData, CustomerAuthErrorPayload>(
    path,
    requestOptions(options)
  );

  if (!response.success || response.data === undefined) {
    throw new CustomerAccountRequestError(
      response.message || "Customer account request failed.",
      response.success ? undefined : response.error?.code
    );
  }

  return response.data;
}

export async function updateCustomerProfile(input: CustomerProfileUpdateInput) {
  const data = await request<CustomerAccountCustomerResponse>("/api/customer-account/profile", {
    method: "PATCH",
    json: input
  });
  return data.customer;
}

export async function claimCustomerUsername(input: CustomerUsernameClaimInput) {
  const data = await request<CustomerAccountCustomerResponse>(
    "/api/customer-account/username/claim",
    {
      method: "POST",
      json: input
    }
  );
  return data.customer;
}

export async function fetchCustomerSecuritySummary(signal?: AbortSignal) {
  return request<CustomerSecuritySummary>("/api/customer-account/security", {
    method: "GET",
    signal
  });
}

export async function requestCustomerPasswordSetup(): Promise<void> {
  const response = await apiClient.request<undefined, CustomerAuthErrorPayload>(
    "/api/customer-account/password/setup/request",
    requestOptions({ method: "POST" })
  );
  if (!response.success) {
    throw new CustomerAccountRequestError(
      response.message || "A password setup code could not be requested.",
      response.error?.code
    );
  }
}

export async function verifyCustomerPasswordSetup(verificationCode: string): Promise<void> {
  const response = await apiClient.request<undefined, CustomerAuthErrorPayload>(
    "/api/customer-account/password/setup/verify",
    requestOptions({
      method: "POST",
      json: { verificationCode }
    })
  );
  if (!response.success) {
    throw new CustomerAccountRequestError(
      response.message || "The password setup code could not be verified.",
      response.error?.code
    );
  }
}

export async function setupCustomerPassword(newPassword: string) {
  const data = await request<CustomerAccountCustomerResponse>(
    "/api/customer-account/password/setup",
    {
      method: "POST",
      json: { newPassword }
    }
  );
  return data.customer;
}

export async function changeCustomerPassword(input: CustomerPasswordChangeInput) {
  const data = await request<CustomerAccountCustomerResponse>(
    "/api/customer-account/password/change",
    {
      method: "POST",
      json: input
    }
  );
  return data.customer;
}

export async function fetchCustomerSessions(signal?: AbortSignal) {
  const data = await request<CustomerSessionsResponse>("/api/customer-account/sessions", {
    method: "GET",
    signal
  });
  return data.sessions;
}

export async function requestCustomerSessionRevokeVerification(): Promise<void> {
  const response = await apiClient.request<undefined, CustomerAuthErrorPayload>(
    "/api/customer-account/sessions/revoke-others/request",
    requestOptions({ method: "POST" })
  );
  if (!response.success) {
    throw new CustomerAccountRequestError(
      response.message || "A security verification code could not be requested.",
      response.error?.code
    );
  }
}

export async function verifyCustomerSessionRevokeVerification(
  verificationCode: string
): Promise<void> {
  const response = await apiClient.request<undefined, CustomerAuthErrorPayload>(
    "/api/customer-account/sessions/revoke-others/verify",
    requestOptions({
      method: "POST",
      json: { verificationCode }
    })
  );
  if (!response.success) {
    throw new CustomerAccountRequestError(
      response.message || "The security verification code could not be verified.",
      response.error?.code
    );
  }
}

export async function revokeOtherCustomerSessions(currentPassword?: string) {
  return request<CustomerSessionRevocationResponse>(
    "/api/customer-account/sessions/revoke-others",
    {
      method: "POST",
      json: currentPassword ? { currentPassword } : {}
    }
  );
}

export async function fetchCustomerFavorites(signal?: AbortSignal) {
  return request<StorefrontFavoriteProduct[]>("/api/customer-account/favorites", {
    method: "GET",
    signal
  });
}

export async function addCustomerFavorite(productId: string) {
  return request<{ productId: string; favorited: true }>(
    `/api/customer-account/favorites/${encodeURIComponent(productId)}`,
    { method: "PUT" }
  );
}

export async function removeCustomerFavorite(productId: string) {
  return request<{ productId: string; favorited: false }>(
    `/api/customer-account/favorites/${encodeURIComponent(productId)}`,
    { method: "DELETE" }
  );
}
