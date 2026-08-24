import { resolveApiUrl } from "@/config/runtime";
import type { StorefrontCategory, StorefrontProduct } from "@/types/storefront";

type ImageBearingProduct = Pick<StorefrontProduct, "id" | "imageUrl" | "name">;

export function getCatalogImageUrl(imageUrl: string | null | undefined) {
  const normalized = imageUrl?.trim();
  if (!normalized) {
    return null;
  }

  return normalized.startsWith("/api/") ? resolveApiUrl(normalized).toString() : normalized;
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
