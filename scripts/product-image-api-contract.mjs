import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../frontend/src/services/productImageApi.ts", import.meta.url),
  "utf8"
);

assert.match(source, /export type ProductImageCandidate/);
assert.match(source, /export async function uploadProductImage/);
assert.match(source, /formData\.set\("image",\s*file\)/);
assert.match(source, /\/images\/\$\{encodeURIComponent\(imageId\)\}\/approve/);
assert.match(source, /\/images\/\$\{encodeURIComponent\(imageId\)\}\/reject/);
assert.match(source, /export async function fetchProductImagePreviewBlob/);
assert.match(source, /Authorization/);
assert.match(source, /response\.blob\(\)/);

console.log("product image frontend api contract passed");
