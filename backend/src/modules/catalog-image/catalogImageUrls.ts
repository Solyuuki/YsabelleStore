const APPROVED_PRODUCT_IMAGE_ROUTE_PATTERN =
  /^\/api\/storefront\/product-images\/([^/]+)\/(card|pdp)$/;

export function resolveProductDetailImageUrl(imageUrl: string | null | undefined) {
  if (!imageUrl) {
    return null;
  }

  const match = APPROVED_PRODUCT_IMAGE_ROUTE_PATTERN.exec(imageUrl);
  if (!match) {
    return imageUrl;
  }

  return `/api/storefront/product-images/${match[1]}/pdp`;
}
