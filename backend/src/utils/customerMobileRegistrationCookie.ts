import type { Request, Response } from "express";

import { env } from "../config/env.js";
import { CUSTOMER_MOBILE_REGISTRATION_OTP_LIFETIME_MS } from "../services/customerMobileRegistrationService.js";

export const CUSTOMER_MOBILE_REGISTRATION_COOKIE_NAME = "ysabelle_customer_registration_mobile";

const registrationMobileCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/api/customer-auth"
};

export function readCustomerMobileRegistrationCookie(request: Request): string | undefined {
  const cookieHeader = request.get("cookie");
  if (!cookieHeader) return undefined;

  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;

    const name = pair.slice(0, separator).trim();
    if (name !== CUSTOMER_MOBILE_REGISTRATION_COOKIE_NAME) continue;

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

export function setCustomerMobileRegistrationCookie(response: Response, grant: string): void {
  response.cookie(CUSTOMER_MOBILE_REGISTRATION_COOKIE_NAME, grant, {
    ...registrationMobileCookieOptions,
    maxAge: CUSTOMER_MOBILE_REGISTRATION_OTP_LIFETIME_MS
  });
}

export function clearCustomerMobileRegistrationCookie(response: Response): void {
  response.cookie(CUSTOMER_MOBILE_REGISTRATION_COOKIE_NAME, "", {
    ...registrationMobileCookieOptions,
    maxAge: 0
  });
}
