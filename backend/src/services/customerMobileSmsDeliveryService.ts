import { env } from "../config/env.js";

const SEMAPHORE_OTP_ENDPOINT = "https://api.semaphore.co/api/v4/otp";
const CUSTOMER_MOBILE_OTP_MESSAGE =
  "Ysabelle Store code: {otp}. Expires in 10 minutes. Do not share this code.";

export class CustomerMobileSmsDeliveryError extends Error {
  public constructor() {
    super("Customer mobile verification SMS delivery failed.");
    this.name = "CustomerMobileSmsDeliveryError";
  }
}

type SemaphoreOtpResult = {
  message_id?: number | string;
  status?: string;
};

type CustomerMobileSmsDeliveryConfig = {
  apiKey?: string;
  senderName?: string;
  fetchImpl?: typeof fetch;
};

function semaphoreNumber(phone: string): string {
  if (!/^\+639\d{9}$/.test(phone)) throw new CustomerMobileSmsDeliveryError();
  return phone.slice(1);
}

function isAcceptedSemaphoreResponse(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) return false;

  return value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const result = item as SemaphoreOtpResult;
    if (result.message_id === undefined || result.message_id === null) return false;
    const status = typeof result.status === "string" ? result.status.trim().toLowerCase() : "";
    return !["failed", "refunded"].includes(status);
  });
}

export function createCustomerMobileSmsDelivery({
  apiKey = env.SEMAPHORE_API_KEY,
  senderName = env.SEMAPHORE_SENDER_NAME,
  fetchImpl = fetch
}: CustomerMobileSmsDeliveryConfig = {}) {
  return async ({
    phone,
    verificationCode
  }: {
    phone: string;
    verificationCode: string;
  }): Promise<void> => {
    const resolvedApiKey = apiKey?.trim();
    if (!resolvedApiKey || !/^\d{6}$/.test(verificationCode)) {
      throw new CustomerMobileSmsDeliveryError();
    }

    const body = new URLSearchParams({
      apikey: resolvedApiKey,
      number: semaphoreNumber(phone),
      message: CUSTOMER_MOBILE_OTP_MESSAGE,
      code: verificationCode
    });
    const resolvedSenderName = senderName?.trim();
    if (resolvedSenderName) body.set("sendername", resolvedSenderName);

    let response: Response;
    try {
      response = await fetchImpl(SEMAPHORE_OTP_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body
      });
    } catch {
      throw new CustomerMobileSmsDeliveryError();
    }

    if (!response.ok) throw new CustomerMobileSmsDeliveryError();

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new CustomerMobileSmsDeliveryError();
    }

    if (!isAcceptedSemaphoreResponse(payload)) throw new CustomerMobileSmsDeliveryError();
  };
}

export const customerMobileSmsDelivery = createCustomerMobileSmsDelivery();
