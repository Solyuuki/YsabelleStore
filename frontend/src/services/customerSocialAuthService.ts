import { frontendRuntimeConfig } from "@/config/runtime";

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

export function getCustomerSocialAuthNotice(search: string): string | null {
  const params = new URLSearchParams(search);
  if (params.get("social") !== "provider_unavailable") return null;

  const provider = params.get("provider");
  if (provider === "google") return "Google sign-in is not configured for this environment yet.";
  if (provider === "facebook") {
    return "Facebook sign-in is not configured for this environment yet.";
  }
  return null;
}

export function startCustomerSocialAuth(
  provider: CustomerSocialAuthProvider,
  returnPath = "/account",
  authPage: CustomerSocialAuthPage = "login"
): void {
  globalThis.location.assign(buildCustomerSocialAuthStartUrl(provider, returnPath, authPage));
}
