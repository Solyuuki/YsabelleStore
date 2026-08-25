import type { StorefrontProduct } from "@/types/storefront";

/**
 * Stable storefront anchors for the About Us live-store preview. These IDs select from the
 * customer-safe catalog response; they never bypass the storefront eligibility policy.
 *
 * Each ID is a high-confidence canonical catalog product mapped directly to an active SARIMA
 * workbook source. Customer delivery remains subject to the standard live-stock gate.
 */
export const ABOUT_STORE_ESSENTIAL_SLOT_COUNT = 4;

export const ABOUT_STORE_ESSENTIAL_PRODUCT_IDS = [
  "prd_sarima_p022_gardenia_white_bread_600g",
  "prd_sarima_p144_ligo_sardines_155g",
  "prd_sarima_p054_sunsilk_anti_dandruff_135ml",
  "prd_sarima_p022_gardenia_white_bread_600g"
] as const satisfies readonly [string, string, string, string];

export type CuratedStorefrontResolution = {
  missingProductIds: string[];
  products: StorefrontProduct[];
};

export function resolveAboutStoreEssentials(
  products: readonly StorefrontProduct[]
): CuratedStorefrontResolution {
  const productById = new Map(products.map((product) => [product.id, product]));
  const resolvedProducts: StorefrontProduct[] = [];
  const missingProductIds: string[] = [];

  ABOUT_STORE_ESSENTIAL_PRODUCT_IDS.slice(0, ABOUT_STORE_ESSENTIAL_SLOT_COUNT).forEach(
    (productId) => {
      const product = productById.get(productId);
      if (!product) {
        missingProductIds.push(productId);
        return;
      }

      resolvedProducts.push(product);
    }
  );

  return {
    missingProductIds,
    products: resolvedProducts.slice(0, ABOUT_STORE_ESSENTIAL_SLOT_COUNT)
  };
}
