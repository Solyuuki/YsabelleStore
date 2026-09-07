import assert from "node:assert/strict";
import test from "node:test";

import {
  isPresentationCatalogEnabled,
  presentationStorefrontProductWhere,
  storefrontCategoryProductWhere,
  storefrontProductWhere
} from "../src/services/catalogQualityPolicy.js";
import { UNRESOLVED_CATALOG_IMAGE_CLEANUP_IDENTITIES } from "../src/modules/catalog/catalog-unresolved-image-cleanup-authorization.js";

test("presentation mode is opt-in", () => {
  assert.equal(isPresentationCatalogEnabled({}), false);
  assert.equal(isPresentationCatalogEnabled({ YSABELLE_PRESENTATION_CATALOG: "1" }), true);
});

test("presentation catalog keeps mapped SARIMA products while excluding frozen unresolved image identities", () => {
  assert.deepEqual(presentationStorefrontProductWhere.sarimaSourceMapping, { isNot: null });
  assert.deepEqual(presentationStorefrontProductWhere.NOT, {
    sarimaSourceMapping: {
      is: {
        sourceProductId: {
          in: UNRESOLVED_CATALOG_IMAGE_CLEANUP_IDENTITIES.map((row) => row.productCode)
        }
      }
    }
  });
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
