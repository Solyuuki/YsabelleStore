import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pageSource = readFileSync(
  resolve(process.cwd(), "frontend/src/pages/ProductsPage.tsx"),
  "utf8"
);
const apiSource = readFileSync(
  resolve(process.cwd(), "frontend/src/services/catalogApi.ts"),
  "utf8"
);

assert.match(pageSource, /All quality/);
assert.match(pageSource, /<option value="NEEDS_REVIEW">Needs review<\/option>/);
assert.match(pageSource, /<option value="APPROVED">Approved<\/option>/);
assert.match(pageSource, /<option value="REJECTED">Rejected<\/option>/);
assert.match(pageSource, /dataQualityStatus:/);
assert.match(apiSource, /dataQualityStatus\?: CatalogQualityStatus/);

console.log("Catalog quality filter UI contract passed.");
