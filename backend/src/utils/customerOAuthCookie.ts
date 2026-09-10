import type { Request, Response } from "express";

import type { CustomerSocialProvider } from "@prisma/client";

import { env } from "../config/env.js";

const OAUTH_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;
const LINK_INTENT_COOKIE_NAME = "ysabelle_customer_social_link_intent";

const baseCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production"
};

function providerSlug(provider: CustomerSocialProvider) {
  return provider.toLowerCase();
}

function bindingCookieName(provider: CustomerSocialProvider) {
  return `ysabelle_customer_oauth_${providerSlug(provider)}_binding`;
}

function readCookie(request: Request, cookieName: string): string | undefined {
  const header = request.get("cookie");
  if (!header) return undefined;

  for (const pair of header.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    if (pair.slice(0, separator).trim() !== cookieName) continue;
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

export function setCustomerOAuthBindingCookie(
  response: Response,
  provider: CustomerSocialProvider,
  browserBinding: string
): void {
  response.cookie(bindingCookieName(provider), browserBinding, {
    ...baseCookieOptions,
    maxAge: OAUTH_COOKIE_MAX_AGE_MS,
    path: `/api/customer-auth/social/${providerSlug(provider)}`
  });
}

export function readCustomerOAuthBindingCookie(
  request: Request,
  provider: CustomerSocialProvider
): string | undefined {
  return readCookie(request, bindingCookieName(provider));
}

export function clearCustomerOAuthBindingCookie(
  response: Response,
  provider: CustomerSocialProvider
): void {
  response.cookie(bindingCookieName(provider), "", {
    ...baseCookieOptions,
    maxAge: 0,
    path: `/api/customer-auth/social/${providerSlug(provider)}`
  });
}

export function setCustomerSocialLinkIntentCookie(response: Response, token: string): void {
  response.cookie(LINK_INTENT_COOKIE_NAME, token, {
    ...baseCookieOptions,
    maxAge: OAUTH_COOKIE_MAX_AGE_MS,
    path: "/api/customer-auth/social"
  });
}

export function readCustomerSocialLinkIntentCookie(request: Request): string | undefined {
  return readCookie(request, LINK_INTENT_COOKIE_NAME);
}

export function clearCustomerSocialLinkIntentCookie(response: Response): void {
  response.cookie(LINK_INTENT_COOKIE_NAME, "", {
    ...baseCookieOptions,
    maxAge: 0,
    path: "/api/customer-auth/social"
  });
}
