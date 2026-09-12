import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const reportsSource = readFileSync(resolve(process.cwd(), "src/pages/ReportsPage.tsx"), "utf8");
const newProductSource = readFileSync(
  resolve(process.cwd(), "src/components/reports/RestockNewProductCard.tsx"),
  "utf8"
);
const receivingSource = readFileSync(
  resolve(process.cwd(), "src/components/reports/RestockReceivingPanel.tsx"),
  "utf8"
);
const apiSource = readFileSync(resolve(process.cwd(), "src/services/restockApi.ts"), "utf8");

// Phase 7 remains a Reports entry point into the canonical Product engine, not a second catalog.
assert.match(reportsSource, /RestockNewProductCard/);
assert.match(newProductSource, /createProduct/);
assert.match(newProductSource, /createRestockOrder/);
assert.match(newProductSource, /dataQualityStatus: "NEEDS_REVIEW"/);
assert.match(newProductSource, /isStorefrontVisible: false/);
assert.match(newProductSource, /zero stock/);
assert.match(newProductSource, /Product pipeline/);
assert.doesNotMatch(newProductSource, /stockInInventory\s*\(/);
assert.doesNotMatch(newProductSource, /\/api\/inventory\//);

// UI is composed from the project's existing open-source component system rather than bespoke
// dialogs/inputs/buttons, preserving the production design-system boundary.
assert.match(newProductSource, /@\/components\/ui\/dialog/);
assert.match(newProductSource, /@\/components\/ui\/button/);
assert.match(newProductSource, /@\/components\/ui\/input/);
assert.match(receivingSource, /@\/components\/ui\/dialog/);
assert.match(receivingSource, /@\/components\/ui\/button/);
assert.match(receivingSource, /@\/components\/ui\/input/);

// Phase 8 exposes the full Owner lifecycle while keeping planning, history, and receiving separate.
assert.match(reportsSource, /"plan" \| "orders" \| "receiving"/);
assert.match(reportsSource, /Receiving/);
assert.match(reportsSource, /RestockReceivingPanel/);
assert.match(apiSource, /\/await-delivery/);
assert.match(apiSource, /\/cancel/);
assert.match(apiSource, /export async function createRestockRequest/);

// Phase 9 makes delivered/damaged/accepted explicit and sends only accepted quantity to receiving.
assert.match(receivingSource, /Delivered/);
assert.match(receivingSource, /Damaged on arrival/);
assert.match(receivingSource, /Accepted into inventory/);
assert.match(receivingSource, /No expiration \/ not applicable/);
assert.match(receivingSource, /Confirm over-delivery/);
assert.match(receivingSource, /confirmNewBarcode/);
assert.match(receivingSource, /Only accepted units were added to physical inventory/);
assert.match(receivingSource, /Atomic receiving/);
assert.doesNotMatch(receivingSource, /stockInInventory\s*\(/);
assert.doesNotMatch(receivingSource, /\/api\/inventory\/.*stock-in/);
assert.match(apiSource, /\/receipts/);

console.log("Restock Phase 7-9 UI contract passed.");
