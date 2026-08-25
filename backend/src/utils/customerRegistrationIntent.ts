import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { Request, Response } from "express";

import { env } from "../config/env.js";

export const CUSTOMER_REGISTRATION_INTENT_COOKIE_NAME =
  "ysabelle_customer_registration_intent";
export const CUSTOMER_REGISTRATION_INTENT_MAX_AGE_MS = 10 * 60 * 1000;
export const CUSTOMER_REGISTRATION_INTENT_MIN_AGE_MS = 750;

const REGISTRATION_INTENT_VERSION = 1;
const REGISTRATION_INTENT_SECRET = randomBytes(32);

const registrationIntentCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/api/customer-auth"
};

type RegistrationIntentPayload = {
  v: 1;
  iat: number;
  nonce: string;
};

function signPayload(encodedPayload: string): string {
  return createHmac("sha256", REGISTRATION_INTENT_SECRET)
    .update(encodedPayload)
    .digest("base64url");
}

function readCookie(request: Request, cookieName: string): string | undefined {
  const cookieHeader = request.get("cookie");
  if (!cookieHeader) return undefined;

  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;

    const name = pair.slice(0, separator).trim();
    if (name !== cookieName) continue;

    const value = pair.slice(separator + 1).trim();
    if (!value) return undefined;

    try {
      return decodeURIComponent(value);
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export function createCustomerRegistrationIntent(now = Date.now()): string {
  const payload: RegistrationIntentPayload = {
    v: REGISTRATION_INTENT_VERSION,
    iat: now,
    nonce: randomBytes(24).toString("base64url")
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signPayload(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function setCustomerRegistrationIntentCookie(
  response: Response,
  intentToken: string
): void {
  response.cookie(CUSTOMER_REGISTRATION_INTENT_COOKIE_NAME, intentToken, {
    ...registrationIntentCookieOptions,
    maxAge: CUSTOMER_REGISTRATION_INTENT_MAX_AGE_MS
  });
}

export function clearCustomerRegistrationIntentCookie(response: Response): void {
  response.cookie(CUSTOMER_REGISTRATION_INTENT_COOKIE_NAME, "", {
    ...registrationIntentCookieOptions,
    maxAge: 0
  });
}

export function readCustomerRegistrationIntentCookie(request: Request): string | undefined {
  return readCookie(request, CUSTOMER_REGISTRATION_INTENT_COOKIE_NAME);
}

export function isCustomerRegistrationIntentValid(
  intentToken: string,
  now = Date.now()
): boolean {
  const parts = intentToken.split(".");
  if (parts.length !== 2) return false;

  const [encodedPayload, suppliedSignature] = parts;
  if (!encodedPayload || !suppliedSignature) return false;

  const expectedSignature = signPayload(encodedPayload);
  let suppliedSignatureBuffer: Buffer;
  let expectedSignatureBuffer: Buffer;

  try {
    suppliedSignatureBuffer = Buffer.from(suppliedSignature, "base64url");
    expectedSignatureBuffer = Buffer.from(expectedSignature, "base64url");
  } catch {
    return false;
  }

  if (
    suppliedSignatureBuffer.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(suppliedSignatureBuffer, expectedSignatureBuffer)
  ) {
    return false;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return false;
  }

  if (!payload || typeof payload !== "object") return false;

  const candidate = payload as Partial<RegistrationIntentPayload>;
  if (
    candidate.v !== REGISTRATION_INTENT_VERSION ||
    typeof candidate.iat !== "number" ||
    !Number.isSafeInteger(candidate.iat) ||
    typeof candidate.nonce !== "string" ||
    candidate.nonce.length < 16
  ) {
    return false;
  }

  const ageMs = now - candidate.iat;
  return (
    ageMs >= CUSTOMER_REGISTRATION_INTENT_MIN_AGE_MS &&
    ageMs <= CUSTOMER_REGISTRATION_INTENT_MAX_AGE_MS
  );
}
