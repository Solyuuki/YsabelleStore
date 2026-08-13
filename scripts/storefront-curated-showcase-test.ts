import assert from "node:assert/strict";

import {
  ABOUT_STORE_ESSENTIAL_PRODUCT_IDS,
  ABOUT_STORE_ESSENTIAL_SLOT_COUNT,
  resolveAboutStoreEssentials
} from "../frontend/src/utils/storefrontCuratedShowcase";
import type { StorefrontProduct } from "../frontend/src/types/storefront";

function createProduct(id: string, overrides: Partial<StorefrontProduct> = {}): StorefrontProduct {
  return {
    id,
    name: `Product ${id}`,
    description: null,
    imageUrl: null,
    unit: "piece",
    sellingPrice: "10.00",
    availableStock: 12,
    stockStatus: "IN_STOCK",
    category: {
      id: "category-pantry",
      name: "Pantry",
      slug: "pantry"
    },
    ...overrides
  };
}

const configuredProducts = [...new Set(ABOUT_STORE_ESSENTIAL_PRODUCT_IDS)].map((id, index) =>
  createProduct(id, {
    imageUrl: `/images/products/verified-${index}.webp`,
    availableStock: index === 0 || index === 2 ? 0 : 5,
    stockStatus:
      index === 1 ? "LOW_STOCK" : index === 0 || index === 2 ? "OUT_OF_STOCK" : "IN_STOCK"
  })
);

const shuffledResolution = resolveAboutStoreEssentials([
  configuredProducts[2],
  createProduct("unrelated-product"),
  configuredProducts[0],
  configuredProducts[1]
]);

assert.equal(ABOUT_STORE_ESSENTIAL_PRODUCT_IDS.length, ABOUT_STORE_ESSENTIAL_SLOT_COUNT);
assert.equal(new Set(ABOUT_STORE_ESSENTIAL_PRODUCT_IDS).size, 3);
assert.equal(shuffledResolution.products.length, ABOUT_STORE_ESSENTIAL_SLOT_COUNT);
assert.deepEqual(
  shuffledResolution.products.map((product) => product.id),
  ABOUT_STORE_ESSENTIAL_PRODUCT_IDS
);
assert.deepEqual(shuffledResolution.missingProductIds, []);
assert.equal(shuffledResolution.products[0].availableStock, 0);
assert.equal(shuffledResolution.products[0].stockStatus, "OUT_OF_STOCK");
assert.ok(shuffledResolution.products.every((product) => product.imageUrl?.endsWith(".webp")));

const partialResolution = resolveAboutStoreEssentials(
  configuredProducts.filter((product) => product.id !== "prd_sarima_p144_ligo_sardines_155g")
);
assert.deepEqual(
  partialResolution.products.map((product) => product.id),
  ABOUT_STORE_ESSENTIAL_PRODUCT_IDS.filter(
    (productId) => productId !== "prd_sarima_p144_ligo_sardines_155g"
  )
);
assert.deepEqual(partialResolution.missingProductIds, ["prd_sarima_p144_ligo_sardines_155g"]);
