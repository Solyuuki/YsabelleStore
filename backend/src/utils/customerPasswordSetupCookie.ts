import type { Request, Response } from "express";

import { env } from "../config/env.js";
import { CUSTOMER_PASSWORD_SETUP_GRANT_LIFETIME_MS } from "./customerPasswordSetupOtp.js";

export const CUSTOMER_PASSWORD_SETUP_GRANT_COOKIE_NAME = "ysabelle_customer_password_setup";

const passwordSetupCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/api/customer-account/password/setup"
};

export function readCustomerPasswordSetupGrantCookie(request: Request): string | undefined {
  const cookieHeader = request.get("cookie");
  if (!cookieHeader) return undefined;

  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;

    const name = pair.slice(0, separator).trim();
    if (name !== CUSTOMER_PASSWORD_SETUP_GRANT_COOKIE_NAME) continue;

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

export function setCustomerPasswordSetupGrantCookie(response: Response, setupGrant: string): void {
  response.cookie(CUSTOMER_PASSWORD_SETUP_GRANT_COOKIE_NAME, setupGrant, {
    ...passwordSetupCookieOptions,
    maxAge: CUSTOMER_PASSWORD_SETUP_GRANT_LIFETIME_MS
  });
}

export function clearCustomerPasswordSetupGrantCookie(response: Response): void {
  response.cookie(CUSTOMER_PASSWORD_SETUP_GRANT_COOKIE_NAME, "", {
    ...passwordSetupCookieOptions,
    maxAge: 0
  });
}
