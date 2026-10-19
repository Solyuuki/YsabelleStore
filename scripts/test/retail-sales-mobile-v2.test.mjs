import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const sales = read("frontend/src/pages/SalesPage.tsx");
const modal = read("frontend/src/components/sales/SalesMobileReceiptDetails.tsx");
const css = read("frontend/src/styles/retail-sales-mobile-v2.css");
const receipt = read("frontend/src/components/receipt/RetailReceiptDialog.tsx");

test("Sales list is compact and keyboard accessible on all phone and tablet presets", () => {
  assert.match(sales, /ys-sales-transaction-row/);
  assert.match(sales, /onClick=\{\(\) => selectSale\(sale\)\}/);
  assert.match(sales, /event.key === "Enter" \|\| event.key === " "/);
  assert.match(sales, /role="button"/);
  assert.match(sales, /tabIndex=\{0\}/);
  assert.match(css, /@media \(max-width: 1024px\)/);
  assert.match(css, /grid-template-rows: auto auto;/);
  assert.match(css, /\.ys-sales-transaction-id/);
  assert.match(css, /\.ys-sales-transaction-total/);
  assert.match(css, /@media \(max-width: 359px\)/);
  assert.match(css, /@media \(min-width: 768px\) and \(max-width: 1024px\)/);
});
test("Tap-to-open sales detail sheet is a single accessible scroll with paired sticky actions", () => {
  assert.match(sales, /window.matchMedia\(SALES_MOBILE_VIEWPORT\)\.matches/);
  assert.match(
    sales,
    /<Dialog open=\{isMobileReceiptOpen\} onOpenChange=\{setIsMobileReceiptOpen\}>/
  );
  assert.match(sales, /className="ys-sales-mobile-sheet-scroll"/);
  assert.match(sales, /className="ys-sales-mobile-sheet-footer"/);
  assert.match(sales, /aria-label="Close receipt details"/);
  assert.match(css, /overflow-y: auto;/);
  assert.match(css, /\.ys-sales-mobile-sheet-footer\s*\{[^}]*position: sticky;/);
  assert.match(sales, /openPrintReceipt\(selectedSale\)/);
  assert.match(sales, /setIsMobileReceiptOpen\(false\)/);
});
test("Receipt item rows retain exact transaction line, batch, and total values", () => {
  for (const field of [
    "sale.saleNumber",
    "sale.saleDate",
    "sale.cashierName",
    "sale.itemCount",
    "sale.items.map",
    "item.productName",
    "item.barcode ?? item.sku",
    "item.quantity",
    "item.unitPrice",
    "item.totalAmount",
    "item.batchId",
    "sale.subtotalAmount",
    "sale.discountAmount",
    "sale.totalAmount"
  ]) {
    assert.ok(modal.includes(field), "Missing sale field: " + field);
  }
  assert.match(css, /\.ys-sales-mobile-item-list\s*\{[^}]*list-style: none;/);
  assert.match(css, /overflow-wrap: anywhere;/);
  assert.match(css, /font-variant-numeric: tabular-nums;/);
});
test("Sales pagination keeps real page-size controls and compact mobile page number", () => {
  assert.match(
    sales,
    /const\s*SALES_PAGE_SIZE_OPTIONS\s*=\s*\[5,\s*\s*10,\s*\s*20\]\s*as\s*const;/
  );
  assert.match(sales, /setSalesPageSize\(nextSize\)/);
  assert.match(sales, /setSalesPage\(1\)/);
  assert.match(sales, /mobileCompact/);
  assert.match(
    css,
    /\.ys-sales-pagination\s*\.ys-inventory-page-token\s*\{\s*display:\s*none;\s*\}/
  );
});
test("Print dialog Close button remains readable in dark mode and official paper unchanged", () => {
  assert.match(sales, /className="ys-sales-print-dialog"/);
  assert.match(receipt, /className="ys-sales-print-close"/);
  assert.match(receipt, /className="ys-sales-print-footer/);
  assert.match(css, /:root.dark \[role="dialog"\]\.ys-sales-print-dialog \.ys-sales-print-close/);
  const printPaper = read("frontend/src/styles/receipt.css");
  assert.match(printPaper, /\.receipt-paper\s*\{[\s\S]*?background: #ffffff;/);
});

test("Retail receipts omit unsupported Discount labels but retain historical adjustments", () => {
  const printed = read("frontend/src/components/receipt/RetailReceipt.tsx");
  const pos = read("frontend/src/pages/PosPageV2.tsx");
  assert.doesNotMatch(sales, />Discount</);
  assert.doesNotMatch(modal, />Discount</);
  assert.doesNotMatch(printed, /label="Discount"/);
  assert.doesNotMatch(pos, /Discount/);
  assert.match(sales, /Number\(selectedSale\.discountAmount\) > 0 \?/);
  assert.match(modal, /Number\(sale\.discountAmount\) > 0 \?/);
  assert.match(printed, /Number\(receipt\.discountAmount\) > 0/);
  assert.match(sales, /Historical adjustment/);
  assert.match(modal, /Historical adjustment/);
  assert.match(printed, /label="Historical adjustment"/);
});

test("VAT breakdown only appears when the sale contains a durable tax snapshot", () => {
  assert.match(sales, /typeof selectedSale\.vatAmount === "string"/);
  assert.match(modal, /typeof sale\.vatAmount === "string"/);
  const printed = read("frontend/src/components/receipt/RetailReceipt.tsx");
  assert.match(printed, /NOT A BIR-REGISTERED VAT INVOICE/);
  assert.match(printed, /VATable sales \(net of VAT\)/);
});
