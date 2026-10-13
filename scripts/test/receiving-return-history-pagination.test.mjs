import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const dialog = read("frontend/src/components/receiving/ReturnHistoryDialog.tsx");
const css = read("frontend/src/styles/receiving-return-history-mobile.css");
const receivingPage = read("frontend/src/pages/ReceivingPage.tsx");

test("Return History uses Deliveries-style compact mobile pagination only in its own dialog", () => {
  assert.match(dialog, /className="ys-report-modal ys-receiving-return-history-dialog/);
  assert.match(dialog, /className="ys-receiving-return-pagination mt-4"/);
  assert.match(dialog, /mobileCompact/);
  assert.match(css, /\.ys-receiving-return-history-dialog \.ys-receiving-return-pagination/);
  assert.match(css, /\.ys-inventory-page-token\s*\{\s*display: none;/);
  assert.match(css, /\.ys-inventory-mobile-page-label\s*\{\s*display: inline-flex;/);
  assert.match(css, /@media \(max-width: 359px\)/);
  assert.match(css, /@media \(max-width: 1024px\)/);
});

test("Return History paging still loads actual return reports with abort and page-size reset", () => {
  assert.match(dialog, /listRestockOrders\(\{ hasReturns: true, page, pageSize \}/);
  assert.match(dialog, /new AbortController\(\)/);
  assert.match(dialog, /onPageChange=\{setPage\}/);
  assert.match(dialog, /onPageSizeChange=\{\(nextSize\) => \{\s*setPageSize\(nextSize\);\s*setPage\(1\);/);
  assert.match(dialog, /onView\(order\)/);
  assert.match(dialog, /totalItems=\{meta\.totalItems\}/);
});

test("Return History dark-mode page-size and navigation contrast, including select options", () => {
  assert.match(css, /:root\.dark\[data-appearance-scope="retail"\]/);
  assert.match(css, /color-scheme: dark !important;/);
  assert.match(css, /select option\s*\{\s*background: #20314a;\s*color: #f4f7ff;/);
  assert.match(css, /\.ys-receiving-return-pagination > p,/);
  assert.match(css, /\.ys-receiving-return-pagination nav button:disabled/);
});

test("Incoming Deliveries cards, pagination and actions retain their existing paths", () => {
  assert.match(receivingPage, /ys-receiving-v2-mobile-list/);
  assert.match(receivingPage, /ReceivingMobileTicketCard key=\{order\.id\} onOpen=\{openTicket\}/);
  assert.match(receivingPage, /className="ys-receiving-v2-pagination m-4"/);
  assert.match(receivingPage, /onPageChange=\{changeQueuePage\}/);
  assert.doesNotMatch(css, /ys-receiving-v2-(?:ticket-card|directory|pagination)/);
});
