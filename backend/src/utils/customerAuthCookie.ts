import type { Request, Response } from "express";

import { env } from "../config/env.js";

export const CUSTOMER_SESSION_COOKIE_NAME = "ysabelle_customer_session";
export const CUSTOMER_SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const customerCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/api"
};

export function readCustomerSessionCookie(request: Request): string | undefined {
  const cookieHeader = request.get("cookie");
  if (!cookieHeader) return undefined;

  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;

    const name = pair.slice(0, separator).trim();
    if (name !== CUSTOMER_SESSION_COOKIE_NAME) continue;

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

export function setCustomerSessionCookie(response: Response, sessionToken: string): void {
  response.cookie(CUSTOMER_SESSION_COOKIE_NAME, sessionToken, {
    ...customerCookieOptions,
    maxAge: CUSTOMER_SESSION_MAX_AGE_MS
  });
}

export function clearCustomerSessionCookie(response: Response): void {
  response.cookie(CUSTOMER_SESSION_COOKIE_NAME, "", {
    ...customerCookieOptions,
    maxAge: 0
  });
}
