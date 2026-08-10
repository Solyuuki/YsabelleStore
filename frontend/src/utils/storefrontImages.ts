import type { StorefrontCategory, StorefrontProduct } from "@/types/storefront";

type ImageBearingProduct = Pick<StorefrontProduct, "id" | "imageUrl" | "name">;

export function getCatalogImageUrl(imageUrl: string | null | undefined) {
  const normalized = imageUrl?.trim();
  return normalized ? normalized : null;
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
