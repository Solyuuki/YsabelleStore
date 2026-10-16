import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../../", import.meta.url);

test("owner product editor exposes editable SKU and availability seen in details", async () => {
  const [source, api] = await Promise.all([
    readFile(new URL("frontend/src/pages/ProductsPageLegacy.tsx", ROOT), "utf8"),
    readFile(new URL("frontend/src/services/catalogApi.ts", ROOT), "utf8")
  ]);

  assert.match(source, /<DetailLine label="SKU" value=\{product\.sku\}/);
  assert.match(source, /htmlFor="edit-sku"/);
  assert.match(source, /sku: form\.sku\.trim\(\)/);
  assert.match(api, /\| "sku"/);
  assert.match(source, /htmlFor="edit-availability"/);
  assert.match(source, /form\.status !== product\.status/);
  assert.match(source, /updateProductStatus\(product\.id, form\.status\)/);
  assert.match(source, /handleViewAvailabilityChange/);
  assert.match(source, /updateProductStatus\(product\.id, action\.nextStatus\)/);
  assert.match(source, /product\.status === "DISCONTINUED"/);
});
