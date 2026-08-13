/**
 * Customer-facing Shop routes own their search context through the Shop toolbar.
 * Keep this deliberately pathname-based so query parameters never alter the header
 * composition for a Shop view.
 */
export function isCustomerShopRoute(pathname: string) {
  return pathname === "/shop" || pathname.startsWith("/shop/");
}
