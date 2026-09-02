const CUSTOMER_API_PREFIXES = [
  "/api/storefront",
  "/api/customer-auth",
  "/api/customer-account"
] as const;

const INTERNAL_APP_ROUTE_PATHS = new Set([
  "/staff-login",
  "/dashboard",
  "/pos",
  "/products",
  "/inventory",
  "/sales",
  "/forecast",
  "/historical-sales",
  "/reports",
  "/users",
  "/settings",
  "/not-found"
]);

export function isInternalAppRoutePath(pathname: string): boolean {
  return INTERNAL_APP_ROUTE_PATHS.has(pathname);
}

export function shouldAttachInternalBearer(url: URL): boolean {
  return !CUSTOMER_API_PREFIXES.some(
    (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)
  );
}
