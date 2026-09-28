import { resolveApiUrl } from "@/config/runtime";
import type { StorefrontCategory, StorefrontProduct } from "@/types/storefront";

type ImageBearingProduct = Pick<StorefrontProduct, "id" | "imageUrl" | "name">;

const catalogImageRevisionByAssetId = {
  "sarima-p219-b7553e591e41": "edge-artifact-20260928"
} as const;

function withCatalogImageRevision(imageUrl: string) {
  for (const [assetId, revision] of Object.entries(catalogImageRevisionByAssetId)) {
    if (imageUrl.includes(`/product-images/${assetId}/`)) {
      return `${imageUrl}${imageUrl.includes("?") ? "&" : "?"}v=${revision}`;
    }
  }

  return imageUrl;
}

export function getCatalogImageUrl(imageUrl: string | null | undefined) {
  const normalized = imageUrl?.trim();
  if (!normalized) {
    return null;
  }

  const resolved = normalized.startsWith("/api/") ? resolveApiUrl(normalized).toString() : normalized;
  return withCatalogImageRevision(resolved);
}

export function hasCatalogImage<T extends { imageUrl?: string | null }>(
  product: T
): product is T & { imageUrl: string } {
  return getCatalogImageUrl(product.imageUrl) !== null;
}

export function getCategoryRepresentativeProducts(
  category: StorefrontCategory
): ImageBearingProduct[] {
  return category.representativeProducts.filter(hasCatalogImage).slice(0, 3);
}
