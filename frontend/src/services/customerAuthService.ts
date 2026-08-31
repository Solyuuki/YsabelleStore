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

export type CustomerRememberedAccount = {
  id: string;
  name: string;
  method: "EMAIL";
  maskedIdentifier: string;
  trusted: boolean;
  trustedUntil: string;
  lastUsedAt: string | null;
};

type CustomerRememberedListData = {
  accounts: CustomerRememberedAccount[];
  maxAccounts: number;
};

type CustomerRememberedContinueData = {
  verificationRequired: boolean;
  customer?: Customer;
  account?: CustomerRememberedAccount;
};

type CustomerRememberedRequestData = {
  account: CustomerRememberedAccount | null;
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

function requireCustomerAuthSuccess(
  response: Awaited<ReturnType<typeof apiClient.request<undefined, CustomerAuthErrorPayload>>>,
  fallback: string
) {
  if (response.success) return;
  throw new CustomerAuthRequestError(response.message || fallback, response.error?.code);
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => globalThis.setTimeout(resolve, milliseconds));
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

export async function requestCustomerEmailAuth(email: string): Promise<void> {
  const response = await apiClient.request<undefined, CustomerAuthErrorPayload>(
    "/api/customer-auth/email/request",
    customerAuthRequestOptions({ method: "POST", json: { email: email.trim() } })
  );
  requireCustomerAuthSuccess(response, "Email verification could not be requested.");
}

export async function verifyCustomerEmailAuth(input: {
  email: string;
  verificationCode: string;
  rememberFor30Days?: boolean;
}): Promise<Customer> {
  const response = await apiClient.request<CustomerResponseData, CustomerAuthErrorPayload>(
    "/api/customer-auth/email/verify",
    customerAuthRequestOptions({
      method: "POST",
      json: {
        email: input.email.trim(),
        verificationCode: input.verificationCode.trim(),
        rememberFor30Days: input.rememberFor30Days === true
      }
    })
  );
  return requireCustomer(response);
}

export async function getCustomerRememberedAccounts(): Promise<{
  accounts: CustomerRememberedAccount[];
  maxAccounts: number;
}> {
  const response = await apiClient.request<CustomerRememberedListData, CustomerAuthErrorPayload>(
    "/api/customer-auth/remembered",
    customerAuthRequestOptions({ method: "GET" })
  );
  if (response.success && response.data) return response.data;
  throw new CustomerAuthRequestError(
    response.message || "Known accounts could not be loaded.",
    response.success ? undefined : response.error?.code
  );
}

export async function continueCustomerRememberedAccount(
  rememberedAccountId: string
): Promise<
  | { status: "authenticated"; customer: Customer }
  | { status: "verification_required"; account: CustomerRememberedAccount }
> {
  const response = await apiClient.request<
    CustomerRememberedContinueData,
    CustomerAuthErrorPayload
  >(
    "/api/customer-auth/remembered/continue",
    customerAuthRequestOptions({ method: "POST", json: { rememberedAccountId } })
  );

  if (!response.success || !response.data) {
    throw new CustomerAuthRequestError(
      response.message || "Known account sign-in could not continue.",
      response.success ? undefined : response.error?.code
    );
  }
  if (response.data.verificationRequired) {
    if (!response.data.account) {
      throw new CustomerAuthRequestError("This known account requires verification.");
    }
    return { status: "verification_required", account: response.data.account };
  }
  if (!response.data.customer) {
    throw new CustomerAuthRequestError("Known account sign-in did not return a customer.");
  }
  return { status: "authenticated", customer: response.data.customer };
}

export async function requestCustomerRememberedVerification(
  rememberedAccountId: string
): Promise<CustomerRememberedAccount | null> {
  const response = await apiClient.request<CustomerRememberedRequestData, CustomerAuthErrorPayload>(
    "/api/customer-auth/remembered/request",
    customerAuthRequestOptions({ method: "POST", json: { rememberedAccountId } })
  );
  if (response.success) return response.data?.account ?? null;
  throw new CustomerAuthRequestError(
    response.message || "Verification could not be requested for this known account.",
    response.error?.code
  );
}

export async function verifyCustomerRememberedVerification(input: {
  rememberedAccountId: string;
  verificationCode: string;
}): Promise<Customer> {
  const response = await apiClient.request<CustomerResponseData, CustomerAuthErrorPayload>(
    "/api/customer-auth/remembered/verify",
    customerAuthRequestOptions({
      method: "POST",
      json: {
        rememberedAccountId: input.rememberedAccountId,
        verificationCode: input.verificationCode.trim()
      }
    })
  );
  return requireCustomer(response);
}

export async function forgetCustomerRememberedAccount(rememberedAccountId: string): Promise<void> {
  const response = await apiClient.request<undefined, CustomerAuthErrorPayload>(
    `/api/customer-auth/remembered/${encodeURIComponent(rememberedAccountId)}`,
    customerAuthRequestOptions({ method: "DELETE" })
  );
  requireCustomerAuthSuccess(response, "This known account could not be forgotten.");
}

export async function requestCustomerRegistrationEmailVerification(email: string): Promise<void> {
  await ensureCustomerRegistrationIntentReady();
  const response = await apiClient.request<undefined, CustomerAuthErrorPayload>(
    "/api/customer-auth/registration/email/request",
    customerAuthRequestOptions({ method: "POST", json: { email: email.trim() } })
  );
  requireCustomerAuthSuccess(response, "Email verification could not be requested.");
}

export async function verifyCustomerRegistrationEmailVerification(input: {
  email: string;
  verificationCode: string;
}): Promise<void> {
  await ensureCustomerRegistrationIntentReady();
  const response = await apiClient.request<undefined, CustomerAuthErrorPayload>(
    "/api/customer-auth/registration/email/verify",
    customerAuthRequestOptions({
      method: "POST",
      json: { email: input.email.trim(), verificationCode: input.verificationCode.trim() }
    })
  );
  requireCustomerAuthSuccess(response, "The verification code could not be verified.");
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

export async function requestCustomerPasswordRecovery(identifier: string): Promise<void> {
  const response = await apiClient.request<undefined, CustomerAuthErrorPayload>(
    "/api/customer-auth/recovery/request",
    customerAuthRequestOptions({
      method: "POST",
      json: { identifier: identifier.trim() }
    })
  );

  requireCustomerAuthSuccess(response, "Password recovery could not be requested.");
}

export async function verifyCustomerPasswordRecoveryCode(input: {
  identifier: string;
  verificationCode: string;
}): Promise<void> {
  const response = await apiClient.request<undefined, CustomerAuthErrorPayload>(
    "/api/customer-auth/recovery/verify",
    customerAuthRequestOptions({
      method: "POST",
      json: {
        identifier: input.identifier.trim(),
        verificationCode: input.verificationCode.trim()
      }
    })
  );

  requireCustomerAuthSuccess(response, "The verification code could not be verified.");
}

export async function resetCustomerPassword(input: { newPassword: string }): Promise<void> {
  const response = await apiClient.request<undefined, CustomerAuthErrorPayload>(
    "/api/customer-auth/recovery/reset",
    customerAuthRequestOptions({
      method: "POST",
      json: input
    })
  );

  requireCustomerAuthSuccess(response, "Your password could not be reset.");
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
