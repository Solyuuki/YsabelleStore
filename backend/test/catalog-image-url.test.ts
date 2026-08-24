import assert from "node:assert/strict";
import test from "node:test";

import { resolveProductDetailImageUrl } from "../src/modules/catalog-image/catalogImageUrls.js";

test("CIQE card URL resolves to the matching PDP variant", () => {
  assert.equal(
    resolveProductDetailImageUrl("/api/storefront/product-images/image-123/card"),
    "/api/storefront/product-images/image-123/pdp"
  );
});

test("legacy static product image remains the detail image", () => {
  assert.equal(
    resolveProductDetailImageUrl("/images/products/legacy-product.webp"),
    "/images/products/legacy-product.webp"
  );
});

test("missing product image remains missing", () => {
  assert.equal(resolveProductDetailImageUrl(null), null);
});
