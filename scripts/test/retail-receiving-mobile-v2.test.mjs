import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = path => readFileSync(new URL("../../"+path, import.meta.url), "utf8");
const page = read("frontend/src/pages/ReceivingPage.tsx");
const css = read("frontend/src/styles/retail-receiving-mobile-v2.css");

test("Receiving v2 mobile overview is compact and preserves the three active queue views", () => {
  assert.match(page, /ys-receiving-v2-summary/);
  assert.match(page, /ys-receiving-v2-stat-mobile/);
  for(const view of ["ready","partial","history"]) assert.ok(page.includes('changeView("'+view+'")'));
  assert.match(page, /ys-receiving-v2-stat-desktop/);
  assert.match(css, /\.ys-receiving-v2-stat-mobile\s*\{[^}]*min-height: 68px;/);
  assert.match(css, /\.ys-receiving-v2-stat-desktop\s*\{\s*display: none;/);
});
test("Receiving v2 mobile ticket cards use the original queue and openTicket action", () => {
  assert.match(page, /visibleOrders\.map\(\(order\) => \(\s*<ReceivingMobileTicketCard/);
  assert.match(page, /onOpen=\{openTicket\}/);
  assert.match(page, /function ReceivingMobileTicketCard/);
  assert.match(page, /const totals = orderTotals\(order\);/);
  assert.match(page, /quantityLabel = order\.status === "RECEIVED"/);
  assert.match(page, /onClick=\{\(\) => onOpen\(order\)\}/);
  assert.match(page, /ys-receiving-v2-desktop-table/);
  assert.match(css, /\.ys-receiving-v2-desktop-table\s*\{\s*display: none;/);
});
test("Status badge contrasts are explicit for awaiting, partial, approved and received including desktop", () => {
  assert.match(page, /data-status=\{order\.status\}/);
  assert.match(page, /data-status=\{selectedOrder\.status\}/);
  assert.match(css, /data-status="AWAITING_DELIVERY"/);
  assert.match(css, /background: #5a4316 !important;/);
  assert.match(css, /color: #ffe7a3 !important;/);
  assert.match(css, /data-status="PARTIALLY_RECEIVED"/);
  assert.match(css, /data-status="APPROVED"/);
  assert.match(css, /data-status="RECEIVED"/);
  assert.match(css, /:root.dark/);
});
test("Mobile ticket item cards show full product, sku, and distinct expected/remaining quantities", () => {
  assert.match(page, /ys-receiving-v2-mobile-items/);
  assert.match(page, /ys-receiving-v2-desktop-items/);
  assert.match(page, /<h4>\{line\.product\.name\}<\/h4>/);
  assert.match(page, /ys-receiving-v2-mobile-sku/);
  assert.match(page, /line\.requestedQuantity\.toLocaleString\(\)/);
  assert.match(page, /remainingQuantity\(line\)\.toLocaleString\(\)/);
  assert.match(css, /\.ys-receiving-v2-item-quantities\s*\{[^}]*grid-template-columns: repeat\(2,minmax\(0,1fr\)\);/);
});
test("Compact Receiving pagination retains server page and page-size controls", () => {
  assert.match(page, /className="ys-receiving-v2-pagination m-4"/);
  assert.match(page, /mobileCompact/);
  assert.match(page, /onPageChange=\{changeQueuePage\}/);
  assert.match(page, /onPageSizeChange=\{changeQueuePageSize\}/);
  assert.match(css, /\.ys-receiving-v2-pagination \.ys-inventory-page-token\s*\{\s*display: none;/);
  assert.match(css, /\.ys-receiving-v2-pagination \.ys-inventory-mobile-page-label/);
});
test("Receiving operational backend actions, validations, and modal scroll are retained", () => {
  for (const fragment of [
    "listRestockOrders(","initialReceiptRows(","cancelRestockOrder(","receiveRestockOrder(",
    "buildReceiptPayload(","confirmReceipt(","ArrivalOptions onSelect={startReceipt}",
    "ReceiptEditor","LotExpiryDialog","ReturnReportDialog",
  ]) assert.ok(page.includes(fragment), fragment);
  assert.match(page, /ys-receiving-v2-dialog-body/);
  assert.match(css, /grid-template-rows: auto minmax\(0,1fr\) auto;/);
  assert.match(css, /overscroll-behavior-y: contain;/);
  assert.match(css, /@media \(max-width: 359px\)/);
  assert.match(css, /@media \(min-width: 700px\) and \(max-width: 1024px\)/);
});
