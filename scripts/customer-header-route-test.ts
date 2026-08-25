import assert from "node:assert/strict";

import { isCustomerShopRoute } from "../frontend/src/utils/customerRoutes.ts";

const shopPaths = ["/shop", "/shop/", "/shop/category/pantry-essentials"];
const globalSearchPaths = [
  "/",
  "/about",
  "/discover",
  "/product/classic-bread-loaf",
  "/cart",
  "/checkout"
];

for (const pathname of shopPaths) {
  assert.equal(
    isCustomerShopRoute(pathname),
    true,
    `Expected ${pathname} to use the Shop search context.`
  );
}

for (const pathname of globalSearchPaths) {
  assert.equal(
    isCustomerShopRoute(pathname),
    false,
    `Expected ${pathname} to retain the global header search.`
  );
}

console.log("Customer header route search behavior passed.");
