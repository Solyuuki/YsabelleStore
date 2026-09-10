import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { listProductsQuerySchema } from "../src/validators/product.validators.js";

test("product list query accepts catalog quality status filters", () => {
  for (const dataQualityStatus of ["NEEDS_REVIEW", "APPROVED", "REJECTED"] as const) {
    const parsed = listProductsQuerySchema.parse({ dataQualityStatus });
    assert.equal(parsed.dataQualityStatus, dataQualityStatus);
  }
});

test("product list query rejects unknown catalog quality statuses", () => {
  assert.throws(() => listProductsQuerySchema.parse({ dataQualityStatus: "UNKNOWN" }));
});

test("product service applies the catalog quality status to the database filter", () => {
  const source = readFileSync(
    resolve(process.cwd(), "backend/src/services/productService.ts"),
    "utf8"
  );
  assert.match(
    source,
    /if \(query\.dataQualityStatus\) \{[\s\S]*?where\.dataQualityStatus = query\.dataQualityStatus;/
  );
});
