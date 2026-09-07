import assert from "node:assert/strict";
import test from "node:test";

import {
  isPresentationCatalogEnabled,
  presentationStorefrontProductWhere,
  renderableStorefrontProductImageWhere,
  storefrontCategoryProductWhere,
  storefrontProductWhere,
  temporaryImageReadyStorefrontProductWhere
} from "../src/services/catalogQualityPolicy.js";
import { UNRESOLVED_CATALOG_IMAGE_CLEANUP_IDENTITIES } from "../src/modules/catalog/catalog-unresolved-image-cleanup-authorization.js";

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

test("presentation catalog keeps mapped SARIMA products while excluding unresolved identities and missing image URLs", () => {
  assert.ok(Array.isArray(presentationStorefrontProductWhere.AND));
  assert.equal(presentationStorefrontProductWhere.AND.length, 2);
  const [coreWhere, imageWhere] = presentationStorefrontProductWhere.AND;
  assert.deepEqual(imageWhere, renderableStorefrontProductImageWhere);
  assert.deepEqual(coreWhere.sarimaSourceMapping, { isNot: null });
  assert.deepEqual(coreWhere.NOT, {
    sarimaSourceMapping: {
      is: {
        sourceProductId: {
          in: UNRESOLVED_CATALOG_IMAGE_CLEANUP_IDENTITIES.map((row) => row.productCode)
        }
      }
    }
  });
});

test("strict temporary image-ready gate also requires a serialized image URL", () => {
  assert.ok(Array.isArray(temporaryImageReadyStorefrontProductWhere.AND));
  assert.equal(temporaryImageReadyStorefrontProductWhere.AND.length, 3);
  assert.deepEqual(temporaryImageReadyStorefrontProductWhere.AND[2], renderableStorefrontProductImageWhere);
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
