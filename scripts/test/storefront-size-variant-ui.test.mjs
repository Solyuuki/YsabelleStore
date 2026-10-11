import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pageSource = await readFile(
  new URL("../../frontend/src/pages/customer/ProductDetailPage.tsx", import.meta.url),
  "utf8"
);
const selectorSource = await readFile(
  new URL("../../frontend/src/components/customer/ProductSizeSelector.tsx", import.meta.url),
  "utf8"
);
const storefrontTypes = await readFile(
  new URL("../../frontend/src/types/storefront.ts", import.meta.url),
  "utf8"
);
const customerCss = await readFile(
  new URL("../../frontend/src/styles/customer.css", import.meta.url),
  "utf8"
);

assert.match(pageSource, /<ProductSizeSelector[\s\S]*variants=\{product\.sizeVariants\}/);
assert.match(selectorSource, /if \(variants\.length < 2\) return null;/);
assert.match(selectorSource, /type="radio"/);
assert.match(selectorSource, /navigate\(`\/product\/\$\{variant\.id\}`\)/);
assert.match(selectorSource, /<ProductImage/);
assert.match(selectorSource, /Show more sizes/);
assert.match(selectorSource, /data-sold-out/);
assert.match(pageSource, /customer-product-detail__media[\s\S]*<ProductSizeSelector/);
assert.match(storefrontTypes, /export type StorefrontSizeVariant/);
assert.match(storefrontTypes, /sizeTier:\s*"SMALL"\s*\|\s*"MEDIUM"\s*\|\s*"LARGE"/);
assert.match(customerCss, /\.customer-product-size-option\[data-selected\]/);
assert.match(customerCss, /scroll-snap-type:\s*inline mandatory/);

console.log("storefront size variant UI contract passed");
