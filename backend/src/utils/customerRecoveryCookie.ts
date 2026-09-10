import type { Request, Response } from "express";

import { env } from "../config/env.js";
import { CUSTOMER_RECOVERY_GRANT_LIFETIME_MS } from "./customerRecoveryOtp.js";

export const CUSTOMER_RECOVERY_GRANT_COOKIE_NAME = "ysabelle_customer_recovery";

const recoveryCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/api/customer-auth/recovery"
};

export function readCustomerRecoveryGrantCookie(request: Request): string | undefined {
  const cookieHeader = request.get("cookie");
  if (!cookieHeader) return undefined;

  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;

    const name = pair.slice(0, separator).trim();
    if (name !== CUSTOMER_RECOVERY_GRANT_COOKIE_NAME) continue;

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

export function setCustomerRecoveryGrantCookie(response: Response, recoveryGrant: string): void {
  response.cookie(CUSTOMER_RECOVERY_GRANT_COOKIE_NAME, recoveryGrant, {
    ...recoveryCookieOptions,
    maxAge: CUSTOMER_RECOVERY_GRANT_LIFETIME_MS
  });
}

export function clearCustomerRecoveryGrantCookie(response: Response): void {
  response.cookie(CUSTOMER_RECOVERY_GRANT_COOKIE_NAME, "", {
    ...recoveryCookieOptions,
    maxAge: 0
  });
}
