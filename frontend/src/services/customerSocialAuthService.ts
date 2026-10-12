import { frontendRuntimeConfig } from "@/config/runtime";
import { apiClient } from "@/services/apiClient";
import type { CustomerAuthErrorPayload } from "@/types/customerAuth";

export type CustomerSocialAuthProvider = "google";
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
    return "This Google account matches an existing Ysabelle Store account. Sign in once with your existing password to link it securely.";
  }

  if (status !== "provider_unavailable") return null;

  const provider = params.get("provider");
  if (provider === "google") return "Google sign-in is not configured for this environment yet.";
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

/**
 * Google's authorization page must not be loaded inside our iframe preview.
 * Navigate the trusted, same-origin preview host instead so OAuth can complete
 * in a full browser tab. Never redirect an unknown embedding page.
 */
export function customerSocialAuthNavigationWindow(currentWindow: Window): Window {
  if (currentWindow.self === currentWindow.top) return currentWindow;

  try {
    const parent = currentWindow.parent;
    if (
      parent === currentWindow.top &&
      parent.location.origin === currentWindow.location.origin &&
      parent.location.pathname === "/mobile-preview.html"
    ) {
      return parent;
    }
  } catch {
    // Cross-origin embedding must not take control of its parent window.
  }

  throw new Error(
    "Google sign-in cannot run inside an embedded page. Open Ysabelle Store in a full browser tab, then try again."
  );
}

export function startCustomerSocialAuth(
  provider: CustomerSocialAuthProvider,
  returnPath = "/account",
  authPage: CustomerSocialAuthPage = "login"
): void {
  const authWindow = customerSocialAuthNavigationWindow(window);
  let destination = returnPath;

  if (authWindow !== window) {
    // OAuth is top-level, but the signed-in customer should land back inside
    // the mobile QA device frame instead of the desktop-width /account page.
    // The backend stores this same-origin relative path in the OAuth state.
    const previewReturn = new URL("/mobile-preview.html", authWindow.location.origin);
    const safeReturnPath =
      returnPath.startsWith("/") &&
      !returnPath.startsWith("//") &&
      !returnPath.includes("\\") &&
      !returnPath.includes("\0")
        ? returnPath
        : "/account";
    previewReturn.searchParams.set("authRoute", safeReturnPath);

    const viewport = authWindow.document.getElementById("device") as HTMLSelectElement | null;
    const preset = viewport?.value;
    const allowedPresets = [
      "320,640",
      "360,800",
      "375,812",
      "390,844",
      "412,915",
      "430,932",
      "768,1024"
    ];
    if (preset && allowedPresets.includes(preset)) {
      previewReturn.searchParams.set("authDevice", preset);
      if (
        preset === "768,1024" &&
        authWindow.document.getElementById("dimensions")?.textContent?.startsWith("1024 × 768")
      ) {
        previewReturn.searchParams.set("authLandscape", "1");
      }
    }

    // Local mobile QA uses :5174, while the OAuth callback uses FRONTEND_URL
    // (:5173). The preview page will safely hand back to :5174 after OAuth.
    if (
      authWindow.location.port === "5174" &&
      ["localhost", "127.0.0.1"].includes(authWindow.location.hostname)
    ) {
      previewReturn.searchParams.set("authPreviewPort", "5174");
    }

    destination = previewReturn.pathname + previewReturn.search;
  }

  const url = buildCustomerSocialAuthStartUrl(provider, destination, authPage);
  authWindow.location.assign(url.toString());
}
