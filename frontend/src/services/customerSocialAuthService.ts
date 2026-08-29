import { frontendRuntimeConfig } from "@/config/runtime";
import { apiClient } from "@/services/apiClient";
import type { CustomerAuthErrorPayload } from "@/types/customerAuth";

export type CustomerSocialAuthProvider = "google" | "facebook";
export type CustomerSocialAuthPage = "login" | "register";

export function buildCustomerSocialAuthStartUrl(
  provider: CustomerSocialAuthProvider,
  returnPath = "/account",
  authPage: CustomerSocialAuthPage = "login",
  apiBaseUrl = frontendRuntimeConfig.apiBaseUrl
): URL {
  const url = new URL(
    `/api/customer-auth/social/${provider}/start`,
    `${apiBaseUrl.replace(/\/$/, "")}/`
  );
  url.searchParams.set("returnPath", returnPath.startsWith("/") ? returnPath : "/account");
  url.searchParams.set("authPage", authPage);
  return url;
}

export function isCustomerSocialLinkRequired(search: string): boolean {
  return new URLSearchParams(search).get("social") === "link_required";
}

export function getCustomerSocialAuthNotice(search: string): string | null {
  const params = new URLSearchParams(search);
  const status = params.get("social");

  if (status === "link_required") {
    return "This Google or Facebook account matches an existing Ysabelle Store account. Sign in once with your existing password to link it securely.";
  }

  if (status !== "provider_unavailable") return null;

  const provider = params.get("provider");
  if (provider === "google") return "Google sign-in is not configured for this environment yet.";
  if (provider === "facebook") {
    return "Facebook sign-in is not configured for this environment yet.";
  }
  return null;
}

export async function completeCustomerSocialLink(): Promise<void> {
  const response = await apiClient.request<undefined, CustomerAuthErrorPayload>(
    "/api/customer-auth/social/link/complete",
    {
      method: "POST",
      credentials: "include"
    }
  );

  if (!response.success) {
    throw new Error(response.message || "Social sign-in method could not be linked.");
  }
}

export function startCustomerSocialAuth(
  provider: CustomerSocialAuthProvider,
  returnPath = "/account",
  authPage: CustomerSocialAuthPage = "login"
): void {
  globalThis.location.assign(buildCustomerSocialAuthStartUrl(provider, returnPath, authPage));
}
