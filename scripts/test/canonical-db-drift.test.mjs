import assert from "node:assert/strict";
import test from "node:test";

import { inspectCanonicalDbDrift } from "../canonical-data-materializer.mjs";

const subset = {
  rows: {
    categories: [{ id: "cat", name: "Canonical" }],
    products: [{ id: "p1", category_id: "cat", name: "Product" }],
    product_image_assets: [],
    product_aliases: [],
    sarima_source_product_mappings: []
  }
};

function prismaWith(rowsByTable) {
  return {
    async $queryRawUnsafe(sql) {
      const match = sql.match(/FROM `([^`]+)`/);
      return rowsByTable[match?.[1]] ?? [];
    }
  };
}

test("canonical DB drift check passes exact committed values", async () => {
  const findings = await inspectCanonicalDbDrift(
    prismaWith({
      categories: [{ id: "cat", name: "Canonical" }],
      products: [{ id: "p1", category_id: "cat", name: "Product" }]
    }),
    subset
  );
  assert.deepEqual(findings, []);
});

test("canonical DB drift check detects hidden same-row field edits", async () => {
  const findings = await inspectCanonicalDbDrift(
    prismaWith({
      categories: [{ id: "cat", name: "Canonical" }],
      products: [{ id: "p1", category_id: "cat", name: "Hidden edit" }]
    }),
    subset
  );
  assert.ok(findings.some((item) => item.includes("products/p1/name")));
});
