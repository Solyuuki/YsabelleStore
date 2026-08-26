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

type CustomerRegistrationIntentData = {
  ready: boolean;
};

const CUSTOMER_REGISTRATION_INTENT_MIN_AGE_MS = 750;
const CUSTOMER_REGISTRATION_INTENT_MAX_AGE_MS = 10 * 60 * 1000;
const CUSTOMER_REGISTRATION_INTENT_REFRESH_MARGIN_MS = 5_000;

let registrationIntentRequest: Promise<void> | null = null;
let registrationIntentReadyAt = 0;
let registrationIntentExpiresAt = 0;

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

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

export async function prepareCustomerRegistrationIntent(): Promise<void> {
  const now = Date.now();
  if (
    registrationIntentRequest &&
    registrationIntentExpiresAt > now + CUSTOMER_REGISTRATION_INTENT_REFRESH_MARGIN_MS
  ) {
    return registrationIntentRequest;
  }

  registrationIntentRequest = (async () => {
    const response = await apiClient.request<
      CustomerRegistrationIntentData,
      CustomerAuthErrorPayload
    >("/api/customer-auth/registration-intent", customerAuthRequestOptions({ method: "GET" }));

    if (!response.success || response.data?.ready !== true) {
      registrationIntentRequest = null;
      registrationIntentReadyAt = 0;
      registrationIntentExpiresAt = 0;
      throw new CustomerAuthRequestError(
        response.message || "Customer registration could not be prepared.",
        response.success ? undefined : response.error?.code
      );
    }

    const issuedAt = Date.now();
    registrationIntentReadyAt = issuedAt + CUSTOMER_REGISTRATION_INTENT_MIN_AGE_MS;
    registrationIntentExpiresAt = issuedAt + CUSTOMER_REGISTRATION_INTENT_MAX_AGE_MS;
  })();

  return registrationIntentRequest;
}

async function ensureCustomerRegistrationIntentReady(): Promise<void> {
  const now = Date.now();
  if (
    !registrationIntentRequest ||
    registrationIntentExpiresAt <= now + CUSTOMER_REGISTRATION_INTENT_REFRESH_MARGIN_MS
  ) {
    await prepareCustomerRegistrationIntent();
  } else {
    await registrationIntentRequest;
  }

  const remainingMs = registrationIntentReadyAt - Date.now();
  if (remainingMs > 0) {
    await delay(remainingMs);
  }
}

function clearPreparedRegistrationIntent() {
  registrationIntentRequest = null;
  registrationIntentReadyAt = 0;
  registrationIntentExpiresAt = 0;
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
  await ensureCustomerRegistrationIntentReady();

  try {
    const response = await apiClient.request<CustomerResponseData, CustomerAuthErrorPayload>(
      "/api/customer-auth/register",
      customerAuthRequestOptions({
        method: "POST",
        json: input
      })
    );

    return requireCustomer(response);
  } finally {
    clearPreparedRegistrationIntent();
  }
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
