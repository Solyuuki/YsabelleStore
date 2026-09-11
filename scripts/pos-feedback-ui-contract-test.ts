import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pageSource = readFileSync(resolve(process.cwd(), "src/pages/PosPageV2.tsx"), "utf8");

assert.match(pageSource, /USB barcode scanners work as keyboard input/);
assert.match(pageSource, /Scan barcode or search name \/ SKU \/ price/);

const addProductToCartSource = pageSource.match(
  /function addProductToCart\([\s\S]*?\n {2}async function handleSearch/
)?.[0];
assert.ok(addProductToCartSource, "POS add-to-cart handler must remain present.");

const outOfStockGuard = addProductToCartSource.match(
  /if \(product\.availableStock <= 0\) \{([\s\S]*?)\n {4}\}/
)?.[1];
assert.ok(outOfStockGuard, "POS must guard out-of-stock products before cart mutation.");
assert.match(
  outOfStockGuard,
  /setCheckoutError/,
  "Out-of-stock feedback must remain owned by Current Sale."
);
assert.doesNotMatch(
  outOfStockGuard,
  /setSearchState|pushToast/,
  "Finding an out-of-stock product must not create duplicate search or toast feedback."
);
assert.match(
  addProductToCartSource,
  /Only \$\{product\.availableStock\} units are available for \$\{product\.name\}\./,
  "Cart quantity limits must remain owned by Current Sale feedback."
);

const checkoutSource = pageSource.match(
  /async function handleCheckout\([^)]*\) \{[\s\S]*?\n {2}function handleVoidSale/
)?.[0];
assert.ok(checkoutSource, "POS checkout handler must remain present.");
assert.doesNotMatch(
  checkoutSource,
  /setSearchState/,
  "Checkout failures must not mutate Product Search feedback state."
);
assert.match(checkoutSource, /setCheckoutError\(response\.message \|\| "Checkout failed\."\)/);
assert.match(checkoutSource, /setCheckoutError\("The POS checkout service is unavailable\."\)/);

console.log("POS scoped feedback UI contract passed.");
