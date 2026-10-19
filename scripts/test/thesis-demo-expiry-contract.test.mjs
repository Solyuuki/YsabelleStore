import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const script = read("backend/src/scripts/backfillThesisDemoExpiries.ts");
const generator = read("backend/src/utils/thesisDemoExpiry.ts");
const stockDomain = read("backend/src/services/stockDomainService.ts");
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
  assert.match(generator, /DEMO_START_UTC = Date\.UTC\(2028, 9, 19\)/);
  assert.match(generator, /EXPIRY_SPREAD_DAYS = 366/);
});

test("inventory omits the demo notification while product details disclose synthetic dates", () => {
  assert.doesNotMatch(inventory, /ThesisDemoExpiryNotice/);
  assert.match(productView, /<ThesisDemoExpiryNotice \/>/);
  assert.match(disclosure, /THESIS DEMO/);
  assert.match(disclosure, /not manufacturer-verified/);
  assert.match(productView, /Nearest batch expiry/);
  assert.match(productService, /inventoryBatches: true/);
});

test("new thesis demo opening, adjustment and reconciliation batches retain an expiry date", () => {
  assert.match(generator, /THESIS_DEMO_PROJECT_ID/);
  assert.match(generator, /RAILWAY_ENVIRONMENT_NAME !== "production"/);
  assert.match(generator, /THESIS_DEMO_EXPIRIES_ENABLED === "false"/);
  assert.match(stockDomain, /getThesisDemoExpiryForNewBatch\(input\.productId, batchCode\)/);
  assert.match(stockDomain, /getThesisDemoExpiryForNewBatch\(product\.id, batchCode\)/);
  assert.match(
    stockDomain,
    /getThesisDemoExpiryForNewBatch\(input\.productId, identifiers\.batchCode\)/
  );
  assert.match(stockDomain, /const expiresAt = input\.expiresAt \?\? null/);
  assert.match(stockDomain, /expiresAt,\s+productId: product\.id/);
});
