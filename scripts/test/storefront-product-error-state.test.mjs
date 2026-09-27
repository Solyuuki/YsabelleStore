import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pageSource = await readFile(
  new URL("../../frontend/src/pages/customer/ProductDetailPage.tsx", import.meta.url),
  "utf8"
);
const customerCss = await readFile(
  new URL("../../frontend/src/styles/customer.css", import.meta.url),
  "utf8"
);

assert.match(pageSource, /customer-product-error-state/);
assert.match(pageSource, /We couldn’t load this product/);
assert.match(pageSource, /This product isn’t available/);
assert.doesNotMatch(pageSource, /<p>\{error\}<\/p>/);
assert.match(pageSource, /customer-button customer-button--secondary/);

assert.match(customerCss, /\.customer-product-error-state\s*\{/);
assert.match(customerCss, /\.customer-product-error-state h1\s*\{/);
assert.match(customerCss, /line-height:\s*1\.75/);
assert.match(customerCss, /\.customer-product-error-state__actions\s*\{/);
assert.doesNotMatch(
  customerCss.match(/\.customer-product-error-state\s*\{[\s\S]*?\n\}/)?.[0] ?? "",
  /border:\s*1px dashed/
);

console.log("storefront product error state contract passed");
