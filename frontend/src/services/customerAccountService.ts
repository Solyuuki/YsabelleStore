import { apiClient } from "@/services/apiClient";
import type { CustomerAuthErrorPayload } from "@/types/customerAuth";
import type {
  CustomerAccountCustomerResponse,
  CustomerPasswordChangeInput,
  CustomerProfileUpdateInput,
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

export async function revokeOtherCustomerSessions(currentPassword: string) {
  return request<CustomerSessionRevocationResponse>(
    "/api/customer-account/sessions/revoke-others",
    {
      method: "POST",
      json: { currentPassword }
    }
  );
}
