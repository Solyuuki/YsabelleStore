import assert from "node:assert/strict";
import test from "node:test";

import { UNRESOLVED_CATALOG_IMAGE_CLEANUP_IDENTITIES } from "../src/modules/catalog/catalog-unresolved-image-cleanup-authorization.js";
import {
  RESTRICTED_ALCOHOL_SOURCE_PRODUCT_IDS,
  STOREFRONT_CATEGORY_APPROVED_NAMES,
  STOREFRONT_CATEGORY_NAMES
} from "../src/modules/catalog/storefront-category-taxonomy.js";
import {
  isPresentationCatalogEnabled,
  presentationStorefrontCategoryWhere,
  presentationStorefrontProductWhere,
  renderableStorefrontProductImageWhere,
  storefrontCategoryProductWhere,
  storefrontProductWhere,
  temporaryImageReadyStorefrontProductWhere
} from "../src/services/catalogQualityPolicy.js";

test("presentation mode is opt-in", () => {
  assert.equal(isPresentationCatalogEnabled({}), false);
  assert.equal(isPresentationCatalogEnabled({ YSABELLE_PRESENTATION_CATALOG: "1" }), true);
});

test("renderable storefront image gate accepts relative and HTTP(S) URLs only", () => {
  assert.deepEqual(renderableStorefrontProductImageWhere, {
    OR: [
      { imageUrl: { startsWith: "/" } },
      { imageUrl: { startsWith: "https://" } },
      { imageUrl: { startsWith: "http://" } }
    ]
  });
});

test("presentation and approved categories retain the exact pre-D01 names until remapping", () => {
  const expected = [...STOREFRONT_CATEGORY_APPROVED_NAMES];
  assert.deepEqual(presentationStorefrontCategoryWhere.name, { in: expected });
  assert.ok(expected.includes("Baking & Dessert"));
  assert.ok(expected.includes("Snacks & Confectionery"));
  assert.ok(expected.includes("Frozen & Chilled"));
  assert.ok(expected.includes("Baking Essentials"));
  assert.ok(expected.includes("Snacks & Sweets"));
  assert.ok(expected.includes("Frozen Foods"));
  assert.equal(expected.includes("Restricted / Retired"), false);
  assert.equal(new Set(expected).size, expected.length);
  assert.equal((STOREFRONT_CATEGORY_NAMES as readonly string[]).includes("Baking & Dessert"), false);
});

test("presentation catalog excludes unresolved images, restricted alcohol, and missing image URLs", () => {
  const andWhere = presentationStorefrontProductWhere.AND;
  assert.ok(Array.isArray(andWhere));
  assert.equal(andWhere.length, 2);

  const coreWhere = andWhere[0];
  const imageWhere = andWhere[1];
  assert.deepEqual(imageWhere, renderableStorefrontProductImageWhere);
  assert.ok(coreWhere && typeof coreWhere === "object" && "sarimaSourceMapping" in coreWhere);
  assert.ok(coreWhere && typeof coreWhere === "object" && "NOT" in coreWhere);

  const narrowedCoreWhere = coreWhere as {
    sarimaSourceMapping: unknown;
    NOT: unknown;
  };
  assert.deepEqual(narrowedCoreWhere.sarimaSourceMapping, { isNot: null });
  assert.deepEqual(narrowedCoreWhere.NOT, {
    OR: [
      {
        sarimaSourceMapping: {
          is: {
            sourceProductId: {
              in: UNRESOLVED_CATALOG_IMAGE_CLEANUP_IDENTITIES.map((row) => row.productCode)
            }
          }
        }
      },
      {
        sarimaSourceMapping: {
          is: {
            sourceProductId: {
              in: [...RESTRICTED_ALCOHOL_SOURCE_PRODUCT_IDS]
            }
          }
        }
      }
    ]
  });
});

test("strict temporary image-ready gate also requires a serialized image URL", () => {
  const andWhere = temporaryImageReadyStorefrontProductWhere.AND;
  assert.ok(Array.isArray(andWhere));
  assert.equal(andWhere.length, 3);
  assert.deepEqual(andWhere[2], renderableStorefrontProductImageWhere);
});

test("presentation category product gate includes presentation products", () => {
  const where = storefrontCategoryProductWhere(true);
  assert.ok("OR" in where);
  assert.ok(Array.isArray(where.OR));
  assert.equal(where.OR.length, 2);
});

test("storefront product query uses presentation category policy when enabled", () => {
  const where = storefrontProductWhere({ name: { contains: "Dole" } }, true);
  assert.ok(Array.isArray(where.AND));
  assert.equal(where.AND.length, 3);
  assert.deepEqual(where.AND[2], { name: { contains: "Dole" } });
});
