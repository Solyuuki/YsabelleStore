import type { Request, RequestHandler, Response } from "express";

import type { CustomerSocialProvider } from "@prisma/client";

import { env } from "../config/env.js";
import { getAuthenticatedCustomer } from "../middleware/customerAuthMiddleware.js";
import {
  completeCustomerWebOAuth,
  redeemCustomerElectronOAuth,
  startCustomerElectronOAuth,
  startCustomerWebOAuth
} from "../services/customerOAuthService.js";
import { getConfiguredCustomerOAuthProvider } from "../services/customerOAuthProviderService.js";
import { completeCustomerSocialLink } from "../services/customerSocialAuthService.js";
import { createSuccessResponse } from "../utils/apiResponse.js";
import { setCustomerSessionCookie } from "../utils/customerAuthCookie.js";
import {
  clearCustomerOAuthBindingCookie,
  clearCustomerSocialLinkIntentCookie,
  readCustomerOAuthBindingCookie,
  readCustomerSocialLinkIntentCookie,
  setCustomerOAuthBindingCookie,
  setCustomerSocialLinkIntentCookie
} from "../utils/customerOAuthCookie.js";
import { HttpError } from "../utils/httpError.js";

const SOCIAL_CALLBACK_STATUS_BY_CODE: Record<string, string> = {
  SOCIAL_AUTH_CANCELLED: "cancelled",
  SOCIAL_AUTH_EMAIL_REQUIRED: "email_required",
  SOCIAL_AUTH_LINK_CONFLICT: "link_conflict",
  SOCIAL_AUTH_ACCOUNT_UNAVAILABLE: "account_unavailable",
  SOCIAL_AUTH_PROVIDER_UNAVAILABLE: "provider_unavailable",
  SOCIAL_AUTH_PROVIDER_ERROR: "provider_error",
  SOCIAL_AUTH_INVALID_CALLBACK: "invalid_callback"
};

function providerFromParam(value: string): CustomerSocialProvider {
  const normalized = value.trim().toUpperCase();
  if (normalized === "GOOGLE" || normalized === "FACEBOOK") return normalized;

  throw new HttpError(400, "Social sign-in provider is unavailable.", {
    code: "SOCIAL_AUTH_PROVIDER_UNAVAILABLE"
  });
}

function providerFromBody(value: unknown): CustomerSocialProvider {
  return providerFromParam(typeof value === "string" ? value : "");
}

function publicBackendUrl(): string {
  return (env.CUSTOMER_OAUTH_PUBLIC_BACKEND_URL ?? `http://localhost:${env.PORT}`).replace(
    /\/$/,
    ""
  );
}

function callbackUrl(provider: CustomerSocialProvider): string {
  return `${publicBackendUrl()}/api/customer-auth/social/${provider.toLowerCase()}/callback`;
}

function safeReturnPath(value: unknown): string {
  if (typeof value !== "string") return "/account";
  if (!value.startsWith("/") || value.startsWith("//")) return "/account";
  if (value.includes("\\") || value.includes("\0")) return "/account";
  return value.slice(0, 300) || "/account";
}

function customerFrontendUrl(pathname: string): string {
  return new URL(pathname, `${env.FRONTEND_URL.replace(/\/$/, "")}/`).toString();
}

function socialErrorRedirect(response: Response, code: string): void {
  const status = SOCIAL_CALLBACK_STATUS_BY_CODE[code] ?? "invalid_callback";
  response.redirect(302, customerFrontendUrl(`/login?social=${status}`));
}

function socialStartUnavailableRedirect(
  response: Response,
  provider: CustomerSocialProvider,
  authPage: unknown
): void {
  const pathname = authPage === "register" ? "/register" : "/login";
  const query = new URLSearchParams({
    social: "provider_unavailable",
    provider: provider.toLowerCase()
  });
  response.redirect(302, customerFrontendUrl(`${pathname}?${query.toString()}`));
}

function readQueryString(request: Request, field: string): string {
  const value = request.query[field];
  return typeof value === "string" ? value : "";
}

export const startCustomerSocialAuth: RequestHandler = async (request, response, next) => {
  let provider: CustomerSocialProvider;
  try {
    provider = providerFromParam(request.params.provider ?? "");
  } catch (error) {
    next(error);
    return;
  }

  try {
    const oauthProvider = getConfiguredCustomerOAuthProvider(provider);
    const started = await startCustomerWebOAuth(
      {
        provider,
        redirectUri: callbackUrl(provider),
        returnPath: safeReturnPath(request.query.returnPath)
      },
      oauthProvider
    );

    setCustomerOAuthBindingCookie(response, provider, started.browserBinding);
    response.redirect(302, started.authorizationUrl.toString());
  } catch (error) {
    if (error instanceof HttpError && error.code === "SOCIAL_AUTH_PROVIDER_UNAVAILABLE") {
      socialStartUnavailableRedirect(response, provider, request.query.authPage);
      return;
    }
    next(error);
  }
};

export const completeCustomerSocialAuth: RequestHandler = async (request, response) => {
  let provider: CustomerSocialProvider;
  try {
    provider = providerFromParam(request.params.provider ?? "");
  } catch {
    socialErrorRedirect(response, "SOCIAL_AUTH_INVALID_CALLBACK");
    return;
  }

  const state = readQueryString(request, "state");
  const code = readQueryString(request, "code");
  const providerError = readQueryString(request, "error");
  const browserBinding = readCustomerOAuthBindingCookie(request, provider) ?? "";

  if (providerError) {
    clearCustomerOAuthBindingCookie(response, provider);
    socialErrorRedirect(
      response,
      providerError === "access_denied" ? "SOCIAL_AUTH_CANCELLED" : "SOCIAL_AUTH_PROVIDER_ERROR"
    );
    return;
  }

  if (!state || !code || !browserBinding) {
    clearCustomerOAuthBindingCookie(response, provider);
    socialErrorRedirect(response, "SOCIAL_AUTH_INVALID_CALLBACK");
    return;
  }

  try {
    const oauthProvider = getConfiguredCustomerOAuthProvider(provider);
    const result = await completeCustomerWebOAuth(
      {
        provider,
        redirectUri: callbackUrl(provider),
        state,
        browserBinding,
        code
      },
      oauthProvider
    );

    clearCustomerOAuthBindingCookie(response, provider);

    if (result.kind === "link_required") {
      setCustomerSocialLinkIntentCookie(response, result.linkIntentToken);
      response.redirect(302, customerFrontendUrl("/login?social=link_required"));
      return;
    }

    setCustomerSessionCookie(response, result.sessionToken);
    response.redirect(302, customerFrontendUrl(safeReturnPath(result.returnPath)));
  } catch (error) {
    clearCustomerOAuthBindingCookie(response, provider);
    socialErrorRedirect(
      response,
      error instanceof HttpError ? error.code : "SOCIAL_AUTH_PROVIDER_ERROR"
    );
  }
};

export const completeCustomerSocialLinkAccount: RequestHandler = async (
  request,
  response,
  next
) => {
  try {
    const customer = getAuthenticatedCustomer(request);
    if (!customer) {
      throw new HttpError(401, "Customer session is required.", {
        code: "CUSTOMER_SESSION_REQUIRED"
      });
    }

    await completeCustomerSocialLink({
      linkIntentToken: readCustomerSocialLinkIntentCookie(request) ?? "",
      authenticatedCustomerId: customer.id
    });
    clearCustomerSocialLinkIntentCookie(response);
    response.status(200).json(createSuccessResponse("Social sign-in method linked successfully."));
  } catch (error) {
    next(error);
  }
};

export const startCustomerElectronSocialAuth: RequestHandler = async (request, response, next) => {
  try {
    const body =
      request.body && typeof request.body === "object"
        ? (request.body as Record<string, unknown>)
        : {};
    const provider = providerFromBody(body.provider);
    const verifierChallenge =
      typeof body.verifierChallenge === "string" ? body.verifierChallenge : "";
    const oauthProvider = getConfiguredCustomerOAuthProvider(provider);
    const started = await startCustomerElectronOAuth(
      { provider, redirectUri: callbackUrl(provider), verifierChallenge },
      oauthProvider
    );

    response.status(200).json(
      createSuccessResponse("Customer social authentication started.", {
        authorizationUrl: started.authorizationUrl.toString(),
        expiresAt: started.expiresAt.toISOString()
      })
    );
  } catch (error) {
    next(error);
  }
};

export const redeemCustomerElectronSocialAuth: RequestHandler = async (request, response, next) => {
  try {
    const body =
      request.body && typeof request.body === "object"
        ? (request.body as Record<string, unknown>)
        : {};
    const code = typeof body.code === "string" ? body.code : "";
    const verifier = typeof body.verifier === "string" ? body.verifier : "";
    const session = await redeemCustomerElectronOAuth({ code, verifier });
    setCustomerSessionCookie(response, session.sessionToken);
    response.status(200).json(
      createSuccessResponse("Customer social authentication successful.", {
        customer: session.customer
      })
    );
  } catch (error) {
    next(error);
  }
};
