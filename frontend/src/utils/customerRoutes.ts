import type { CustomerAuthStatus } from "@/types/customerAuth";

export type CustomerAuthPageKind = "login" | "register" | "recovery" | "account";

/**
 * Customer-facing Shop routes own their search context through the Shop toolbar.
 * Keep this deliberately pathname-based so query parameters never alter the header
 * composition for a Shop view.
 */
export function isCustomerShopRoute(pathname: string) {
  return pathname === "/shop" || pathname.startsWith("/shop/");
}

export function getCustomerAuthPageKind(pathname: string): CustomerAuthPageKind | null {
  if (pathname === "/login") return "login";
  if (pathname === "/register") return "register";
  if (pathname === "/account-recovery") return "recovery";
  if (pathname === "/account") return "account";
  return null;
}

export function resolveCustomerAuthRedirect(
  pathname: string,
  status: CustomerAuthStatus
): string | null {
  if (status === "loading") return null;

  if (pathname === "/account" && status === "unauthenticated") {
    return "/login";
  }

  if ((pathname === "/login" || pathname === "/register") && status === "authenticated") {
    return "/account";
  }

  return null;
}
