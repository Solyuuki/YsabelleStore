import { frontendRuntimeConfig } from "@/config/runtime";

export type CustomerSocialAuthProvider = "google" | "facebook";

export function buildCustomerSocialAuthStartUrl(
  provider: CustomerSocialAuthProvider,
  returnPath = "/account",
  apiBaseUrl = frontendRuntimeConfig.apiBaseUrl
): URL {
  const url = new URL(`/api/customer-auth/social/${provider}/start`, `${apiBaseUrl.replace(/\/$/, "")}/`);
  url.searchParams.set("returnPath", returnPath.startsWith("/") ? returnPath : "/account");
  return url;
}

export function startCustomerSocialAuth(
  provider: CustomerSocialAuthProvider,
  returnPath = "/account"
): void {
  globalThis.location.assign(buildCustomerSocialAuthStartUrl(provider, returnPath));
}
