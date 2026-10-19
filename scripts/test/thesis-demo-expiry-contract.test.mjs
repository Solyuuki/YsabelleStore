import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const script = read("backend/src/scripts/backfillThesisDemoExpiries.ts");
const inventory = read("frontend/src/pages/InventoryPage.tsx");
const productView = read("frontend/src/pages/ProductsPageLegacy.tsx");
const productService = read("backend/src/services/productService.ts");
const disclosure = read("frontend/src/components/shared/ThesisDemoExpiryNotice.tsx");

test("demo expiration backfill requires explicit apply and preserves existing expirations", () => {
  assert.match(script, /--apply-thesis-demo-2026-10-19/);
  assert.match(script, /expiresAt: null/);
  assert.match(script, /quantityRemaining: \{ gt: 0 \}/);
  assert.match(script, /where: \{ id: batch\.id, expiresAt: null \}/);
  assert.match(script, /RAILWAY_ENVIRONMENT_NAME !== "production"/);
  assert.match(script, /RAILWAY_PROJECT_ID !== "78e2a5d3-f0f8-4e4a-a425-41bb4c6e161e"/);
  assert.match(script, /DEMO_START_UTC = Date\.UTC\(2028, 9, 19\)/);
  assert.match(script, /EXPIRY_SPREAD_DAYS = 366/);
});

test("owner inventory and products disclose synthetic demo date origin", () => {
  assert.match(inventory, /<ThesisDemoExpiryNotice \/>/);
  assert.match(productView, /<ThesisDemoExpiryNotice \/>/);
  assert.match(disclosure, /THESIS DEMO/);
  assert.match(disclosure, /not manufacturer-verified/);
  assert.match(productView, /Nearest batch expiry/);
  assert.match(productService, /inventoryBatches: true/);
});
