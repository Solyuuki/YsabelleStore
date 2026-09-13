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
assert.match(dialogSource, /Existing Restock Order/);
assert.match(dialogSource, /listRestockOrders/);
assert.match(dialogSource, /AWAITING_DELIVERY/);
assert.match(dialogSource, /PARTIALLY_RECEIVED/);
assert.match(dialogSource, /Build delivery session/);
assert.match(dialogSource, /Product name, SKU, barcode, or YSB label/);
assert.match(dialogSource, /Preview PDF/);
assert.match(dialogSource, /Delivery Session/);
assert.match(dialogSource, /Expected/);
assert.match(dialogSource, /Already accepted/);
assert.match(dialogSource, /Remaining/);
assert.match(dialogSource, /Delivered/);
assert.match(dialogSource, /Damaged/);
assert.match(dialogSource, /Accepted/);
assert.match(dialogSource, /Missing/);
assert.match(dialogSource, /Damage \/ return reason/);
assert.match(dialogSource, /Use expected quantities/);
assert.match(dialogSource, /Review delivery/);
assert.match(dialogSource, /Discrepancies/);
assert.match(dialogSource, /Missing expiry/);
assert.match(dialogSource, /Unresolved/);
assert.match(dialogSource, /AppPagination/);
assert.match(dialogSource, /Complete receipt/);
assert.match(dialogSource, /completeBulkDeliverySession/);
assert.match(dialogSource, /restockOrderId: selectedOrder\?\.id/);
assert.match(dialogSource, /expectedOrderVersion: selectedOrder\?\.version/);
assert.match(dialogSource, /restockOrderLineId/);
assert.match(dialogSource, /confirmOverDelivery/);
assert.match(dialogSource, /requiresReturnReport/);
assert.match(
  dialogSource,
  /expected, missing, damaged, return-report, and partial-delivery history/
);
assert.match(dialogSource, /Standalone imports are for accepted stock only/);
assert.doesNotMatch(dialogSource, /confirmInventoryStockImport/);
assert.match(dialogSource, /lookupInventoryByBarcode/);
assert.match(dialogSource, /fetchProducts/);
assert.doesNotMatch(dialogSource, /ProductQuickAddDialog/);
assert.doesNotMatch(dialogSource, /createProduct\s*\(/);
assert.match(dialogSource, /No canonical Product matched/);
assert.match(dialogSource, /Open Products/);
assert.doesNotMatch(dialogSource, /Google Drive/);
assert.doesNotMatch(dialogSource, /ZIP|RAR|TAR\.GZ|package archive/i);

assert.match(apiSource, /\/api\/inventory\/delivery-sessions\/complete/);
assert.match(apiSource, /sourceType: BulkDeliverySourceType/);
assert.match(apiSource, /restockOrderId/);
assert.match(apiSource, /expectedOrderVersion/);
assert.match(apiSource, /restockOrderLineId/);
assert.match(apiSource, /receivedQuantity/);
assert.match(apiSource, /damagedQuantity/);
assert.match(apiSource, /acceptedQuantity/);
assert.match(apiSource, /batchCode/);
assert.match(apiSource, /noExpiration/);
assert.match(apiSource, /requiresReturnReport/);

console.log("Restock Phase 10 bulk delivery UI contract passed.");