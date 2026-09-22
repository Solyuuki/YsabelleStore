import type { CustomerAuthStatus } from "@/types/customerAuth";

export type CustomerAuthPageKind = "login" | "register" | "recovery" | "account";

const AUTH_ROUTE_PATHS = new Set(["/login", "/register", "/account-recovery"]);

/**
 * Customer-facing Shop routes own their search context through the Shop toolbar.
 * Keep this deliberately pathname-based so query parameters never alter the header
 * composition for a Shop view.
 */
export function isCustomerShopRoute(pathname: string) {
  return pathname === "/shop" || pathname.startsWith("/shop/");
}

export function isCustomerProtectedRoute(pathname: string) {
  return pathname === "/account" || pathname === "/checkout";
}

export function getCustomerAuthPageKind(pathname: string): CustomerAuthPageKind | null {
  if (pathname === "/login") return "login";
  if (pathname === "/register") return "register";
  if (pathname === "/account-recovery") return "recovery";
  if (pathname === "/account") return "account";
  return null;
}

export function getCustomerReturnPath(search: string): string | null {
  const candidate = new URLSearchParams(search).get("returnTo");
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return null;

  try {
    const url = new URL(candidate, "https://ysabelle.local");
    if (url.origin !== "https://ysabelle.local" || AUTH_ROUTE_PATHS.has(url.pathname)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function buildCustomerAuthPath(
  pathname: "/login" | "/register",
  returnTo?: string | null
) {
  if (!returnTo) return pathname;
  return `${pathname}?returnTo=${encodeURIComponent(returnTo)}`;
}

export function resolveCustomerAuthRedirect(
  pathname: string,
  status: CustomerAuthStatus,
  search = ""
): string | null {
  if (status === "loading") return null;

  if (isCustomerProtectedRoute(pathname) && status === "unauthenticated") {
    return buildCustomerAuthPath("/login", `${pathname}${search}`);
  }

  if (pathname === "/login" && status === "authenticated") {
    return getCustomerReturnPath(search) ?? "/";
  }

  if (pathname === "/register" && status === "authenticated") {
    return getCustomerReturnPath(search) ?? "/account";
  }

  return null;
}
