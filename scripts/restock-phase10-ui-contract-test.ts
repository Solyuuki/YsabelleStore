import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dialogSource = readFileSync(
  resolve(process.cwd(), "src/components/inventory/InventoryImportDialog.tsx"),
  "utf8"
);
const apiSource = readFileSync(resolve(process.cwd(), "src/services/bulkDeliveryApi.ts"), "utf8");

assert.match(dialogSource, /Import inventory delivery/);
assert.match(dialogSource, /Excel \/ CSV/);
assert.match(dialogSource, /resetMode\("PDF"\)/);
assert.match(dialogSource, /Bulk delivery guide/);
assert.match(dialogSource, /Drop an Excel or CSV delivery file here/);
assert.match(dialogSource, /Drop a delivery PDF here/);
assert.match(dialogSource, /Build delivery session/);
assert.match(dialogSource, /Product name, SKU, barcode, or YSB label/);
assert.match(dialogSource, /Preview PDF/);
assert.match(dialogSource, /Complete receipt/);
assert.match(dialogSource, /completeBulkDeliverySession/);
assert.match(dialogSource, /sourceType: "SPREADSHEET"/);
assert.doesNotMatch(dialogSource, /confirmInventoryStockImport/);
assert.match(dialogSource, /lookupInventoryByBarcode/);
assert.match(dialogSource, /fetchProducts/);
assert.match(dialogSource, /max-w-\[760px\]/);
assert.doesNotMatch(dialogSource, /Google Drive/);
assert.doesNotMatch(dialogSource, /ZIP|RAR|TAR\.GZ|package archive/i);

assert.match(apiSource, /\/api\/inventory\/delivery-sessions\/complete/);
assert.match(apiSource, /sourceType: BulkDeliverySourceType/);
assert.match(apiSource, /receivedQuantity/);
assert.match(apiSource, /batchCode/);
assert.match(apiSource, /noExpiration/);

console.log("Restock Phase 10 bulk delivery UI contract passed.");
