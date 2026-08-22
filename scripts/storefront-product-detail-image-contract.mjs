import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [types, detailPage] = await Promise.all([
  readFile(new URL("../frontend/src/types/storefront.ts", import.meta.url), "utf8"),
  readFile(new URL("../frontend/src/pages/customer/ProductDetailPage.tsx", import.meta.url), "utf8")
]);

assert.match(types, /detailImageUrl\?:\s*string\s*\|\s*null/);
assert.match(detailPage, /imageUrl=\{product\.detailImageUrl\s*\?\?\s*product\.imageUrl\}/);

console.log("storefront product detail image frontend contract passed");
