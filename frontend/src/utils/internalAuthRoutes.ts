const CUSTOMER_API_PREFIXES = [
  "/api/storefront",
  "/api/customer-auth",
  "/api/customer-account"
] as const;

export function shouldAttachInternalBearer(url: URL): boolean {
  return !CUSTOMER_API_PREFIXES.some(
    (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)
  );
}
