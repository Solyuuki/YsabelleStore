import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const page = read("frontend/src/pages/DeliveriesPage.tsx");
const css = read("frontend/src/styles/retail-deliveries-mobile-v2.css");

test("delivery tickets keep single-source server pagination with compact mobile rows", () => {
  assert.match(page, /ys-delivery-metrics\s*grid/);
  assert.match(page, /ys-delivery-ticket-table\s*retail-mobile-data-table/);
  assert.match(page, /tickets\.map\(\(ticket\)\s*=>/);
  assert.match(page, /openTicket\(ticket\.id\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
});

test("mobile delivery filtering and search preserve backend semantics", () => {
  assert.match(page, /placeholder="Find ticket"/);
  assert.match(page, /aria-controls="ys-delivery-filter-fields"/);
  assert.match(page, /data-open=\{mobileFiltersOpen\}/);
  assert.match(page, /setMobileFiltersOpen\(\(open\) => !open\)/);
  assert.match(page, /setPaymentMethod\(event\.target\.value as StorefrontPaymentMethod/);
  assert.match(page, /setStatus\(event\.target\.value as StorefrontDeliveryStatus/);
  assert.match(css, /ys-delivery-filter-fields\[data-open="false"\]/);
  assert.match(page, /listDeliveryTickets\(/);
});

test("ticket details expose full mobile scroll, a close button and full delivery progress", () => {
  assert.match(page, /ys-delivery-ticket-dialog\s*max-h/);
  assert.match(page, /aria-label="Close\s*delivery\s*ticket"/);
  assert.match(page, /ys-delivery-progress-steps\s*flex\s*min-w-\[650px\]/);
  assert.match(css, /ys-delivery-progress-steps\s*\{\s*display:\s*grid;/);
  assert.doesNotMatch(page, /<ScrollArea/);
  assert.match(page, /selected\.timeline\.map/);
  assert.match(page, /selected\.items\.map/);
});

test("Order placed and Preparing have legible badges in both themes", () => {
  assert.match(page, /data-status=\{ticket\.deliveryStatus\}/);
  assert.match(page, /data-status=\{selected\.deliveryStatus\}/);
  assert.match(page, /data-tone=\{operationalStatusTone\(ticket\)\}/);
  assert.match(page, /data-tone=\{operationalStatusTone\(selected\)\}/);
  assert.match(css, /background-color: #344763 !important;/);
  assert.match(css, /color: #f5f8ff !important;/);
});

test("small screens default ten tickets while desktop stays twenty", () => {
  assert.match(page, /const DELIVERY_DESKTOP_PAGE_SIZE = 20;/);
  assert.match(page, /const DELIVERY_MOBILE_PAGE_SIZE = 10;/);
  assert.match(page, /useState\(defaultDeliveryPageSize\)/);
  assert.match(page, /updateDeliveryStatus\(/);
  assert.match(page, /confirmCodCollected\(/);
});

test("delivery search displays only one visual search icon without changing submit behavior", () => {
  const searchSection = page.slice(
    page.indexOf('className="ys-delivery-search-form'),
    page.indexOf('className="ys-delivery-filter-toggle')
  );
  assert.equal((searchSection.match(/<Search\b/g) ?? []).length, 1);
  assert.match(searchSection, /type="submit"\s*variant="secondary"/);
  assert.match(searchSection, /onSubmit=\{\(event\)\s*=>/);
});

test("delivery pagination places compact page size at left and page controls at right on phones", () => {
  assert.match(page, /className="ys-delivery-pagination"/);
  assert.match(css, /\.ys-delivery-pagination > div > label > span\s*\{\s*display: none;/);
  assert.match(css, /\.ys-delivery-pagination > div\s*\{\s*display: flex;\s*flex-wrap: nowrap;/);
  assert.match(css, /\.ys-delivery-pagination nav\s*\{/);
  assert.match(page, /onPageSizeChange=\{\(next\) =>/);
});

test("rider reference uses a concise placeholder and wraps its helper on narrow ticket screens", () => {
  assert.match(page, /placeholder="Booking ID \/ plate \/ rider code"/);
  assert.match(page, /ys-delivery-rider-helper/);
  assert.match(css, /\.ys-delivery-rider-helper\s*\{/);
  assert.match(css, /overflow-wrap:\s*anywhere;/);
});

test("staff note placeholder fits a narrow ticket without removing privacy guidance", () => {
  assert.ok(page.includes('placeholder="Staff-only note"'));
  assert.ok(page.includes("This operational note is not shown to the customer."));
  assert.ok(page.includes("onChange={(event) => setStaffNote(event.target.value)}"));
});
