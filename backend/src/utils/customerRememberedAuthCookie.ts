import { createHash, randomBytes } from "node:crypto";

import type { Request, Response } from "express";

import { env } from "../config/env.js";

export const CUSTOMER_REMEMBERED_BROWSER_COOKIE_NAME = "ysabelle_customer_remembered_browser";
export const CUSTOMER_REMEMBERED_BROWSER_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

const rememberedBrowserCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/api/customer-auth"
};

export function createCustomerRememberedBrowserToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashCustomerRememberedBrowserToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function readCustomerRememberedBrowserCookie(request: Request): string | undefined {
  const cookieHeader = request.get("cookie");
  if (!cookieHeader) return undefined;

  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;

    const name = pair.slice(0, separator).trim();
    if (name !== CUSTOMER_REMEMBERED_BROWSER_COOKIE_NAME) continue;

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

export function setCustomerRememberedBrowserCookie(response: Response, token: string): void {
  response.cookie(CUSTOMER_REMEMBERED_BROWSER_COOKIE_NAME, token, {
    ...rememberedBrowserCookieOptions,
    maxAge: CUSTOMER_REMEMBERED_BROWSER_COOKIE_MAX_AGE_MS
  });
}

export function clearCustomerRememberedBrowserCookie(response: Response): void {
  response.cookie(CUSTOMER_REMEMBERED_BROWSER_COOKIE_NAME, "", {
    ...rememberedBrowserCookieOptions,
    maxAge: 0
  });
}
