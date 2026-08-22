import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../frontend/src/pages/ProductsPage.tsx", import.meta.url),
  "utf8"
);

assert.match(source, /ProductImageUploadPanel/);
assert.match(source, /createdProductId/);
assert.match(source, /onSelectionChange/);
assert.match(source, /onApproved/);
assert.doesNotMatch(source, /id="product-image-url"/);
assert.doesNotMatch(source, /id="edit-image-url"/);
assert.doesNotMatch(source, /imageUrl:\s*form\.imageUrl\.trim\(\)\s*\|\|\s*null/);
assert.match(source, /Product created; image needs attention/i);

console.log("products page product-image workflow contract passed");
