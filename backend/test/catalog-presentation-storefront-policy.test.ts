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
