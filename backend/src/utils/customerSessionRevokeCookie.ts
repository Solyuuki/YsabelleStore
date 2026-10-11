import type { Request, Response } from "express";

import { env } from "../config/env.js";
import { CUSTOMER_SESSION_REVOKE_GRANT_LIFETIME_MS } from "./customerSessionRevokeOtp.js";

export const CUSTOMER_SESSION_REVOKE_GRANT_COOKIE_NAME = "ysabelle_customer_session_revoke";

const sessionRevokeCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/api/customer-account/sessions/revoke-others"
};

export function readCustomerSessionRevokeGrantCookie(request: Request): string | undefined {
  const cookieHeader = request.get("cookie");
  if (!cookieHeader) return undefined;

  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;

    const name = pair.slice(0, separator).trim();
    if (name !== CUSTOMER_SESSION_REVOKE_GRANT_COOKIE_NAME) continue;

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

export function setCustomerSessionRevokeGrantCookie(
  response: Response,
  sessionRevokeGrant: string
): void {
  response.cookie(CUSTOMER_SESSION_REVOKE_GRANT_COOKIE_NAME, sessionRevokeGrant, {
    ...sessionRevokeCookieOptions,
    maxAge: CUSTOMER_SESSION_REVOKE_GRANT_LIFETIME_MS
  });
}

export function clearCustomerSessionRevokeGrantCookie(response: Response): void {
  response.cookie(CUSTOMER_SESSION_REVOKE_GRANT_COOKIE_NAME, "", {
    ...sessionRevokeCookieOptions,
    maxAge: 0
  });
}
