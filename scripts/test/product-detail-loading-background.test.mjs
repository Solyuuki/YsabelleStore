import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) =>
  readFileSync(new URL("../../" + path, import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("initial product loading reuses the completed product page galaxy stage", () => {
  const product = read("frontend/src/pages/customer/ProductDetailPage.tsx");
  const loadingStart = product.indexOf("  if (!product)");
  const loadingEnd = product.indexOf("  const outOfStock =", loadingStart);
  assert.ok(loadingStart >= 0 && loadingEnd > loadingStart, "Product loading branch was not found");

  const loading = product.slice(loadingStart, loadingEnd);
  assert.ok(loading.includes('className="customer-page customer-product-page"'));
  assert.ok(
    loading.includes('<StorefrontGalaxyArtwork className="customer-product-page__cosmos" />')
  );
  assert.ok(loading.includes('className="customer-container"'));
  assert.ok(loading.includes('<div className="customer-inline-state">Loading product...</div>'));

  const loaded = product.slice(loadingEnd, product.indexOf("function ReviewsSection("));
  assert.ok(loaded.includes('className="customer-page customer-product-page"'));
  assert.ok(
    loaded.includes('<StorefrontGalaxyArtwork className="customer-product-page__cosmos" />')
  );
  assert.equal(
    product.split('<StorefrontGalaxyArtwork className="customer-product-page__cosmos" />').length -
      1,
    2,
    "Loading and loaded product stages must share the same artwork component"
  );
});

test("existing proportional galaxy styling is used only in dark mode, without new stretch", () => {
  const css = read("frontend/src/styles/theme-storefront.css");
  const artwork = read("frontend/src/components/customer/StorefrontGalaxyArtwork.tsx");

  assert.ok(css.includes(".customer-app .customer-product-page__cosmos {\n  display: none;"));
  assert.ok(css.includes(":root.dark .customer-app .customer-product-page {"));
  assert.ok(css.includes("background: var(--storefront-galaxy-background);"));
  assert.ok(
    css.includes(":root.dark .customer-app .customer-product-page > .customer-container {")
  );
  assert.ok(css.includes("z-index: 1;"));
  assert.ok(css.includes("aspect-ratio: 1024 / 1536;"));
  assert.ok(css.includes("transform: translateX(-50%);"));
  assert.ok(artwork.includes('preserveAspectRatio="xMidYMid meet"'));
  assert.ok(artwork.includes('viewBox="0 0 1024 1536"'));
});
