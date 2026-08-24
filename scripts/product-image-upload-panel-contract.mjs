import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../frontend/src/components/catalog/ProductImageUploadPanel.tsx", import.meta.url),
  "utf8"
);

assert.match(source, /accept="\.jpg,\.jpeg,\.png,\.webp"/);
assert.match(source, /8\s*\*\s*1024\s*\*\s*1024/);
assert.match(source, /uploadProductImage/);
assert.match(source, /fetchProductImagePreviewBlob/);
assert.match(source, /approveProductImage/);
assert.match(source, /Original/);
assert.match(source, /Optimized/);
assert.match(source, /Use Optimized Image/);
assert.match(source, /candidate\.qualityStatus\s*===\s*"APPROVED"/);
assert.match(source, /candidate\.processingStatus\s*===\s*"READY"/);
assert.doesNotMatch(source, /Use anyway/i);
assert.match(source, /URL\.revokeObjectURL/);

console.log("product image upload panel contract passed");
