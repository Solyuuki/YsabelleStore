import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");

test("Sales receipt keeps independent scroll viewport between fixed cashier and totals", () => {
  const page = read("frontend/src/pages/SalesPage.tsx");
  const receipt = page.slice(page.indexOf("<CardTitle>Receipt details</CardTitle>"));
  const parent = receipt.indexOf(
    'className="space-y-4 xl:flex xl:min-h-0 xl:flex-1 xl:flex-col xl:gap-3 xl:space-y-0"'
  );
  const cashier = receipt.indexOf("Cashier:");
  const scroll = receipt.indexOf('className="ys-sales-receipt-scroll');
  const itemList = receipt.indexOf("selectedSale.items.map");
  const subtotal = receipt.indexOf("Subtotal");

  assert.ok(parent >= 0, "fixed sections need a persistent desktop flex gap");
  assert.ok(parent < cashier && cashier < scroll && scroll < itemList && itemList < subtotal);
  assert.match(receipt, /ys-sales-receipt-scroll min-h-0 space-y-3 xl:flex-1/);
  assert.match(receipt, /xl:overflow-y-auto xl:overscroll-contain xl:rounded-md/);
  assert.match(receipt, /xl:py-2 xl:pl-1 xl:pr-3/);
  assert.doesNotMatch(receipt, /xl:pr-1/);
  assert.match(receipt, /min-w-0 flex-1/);
  assert.match(receipt, /break-words font-medium text-slate-950/);
  assert.match(receipt, /shrink-0 whitespace-nowrap text-right/);
});

test("Sales scroll track reserves width only at desktop without changing dark card colors", () => {
  const css = read("frontend/src/styles/theme-retail.css");
  assert.match(
    css,
    /@media \(min-width: 1280px\) \{\s*\.app-shell-ambient \.ys-sales-receipt-scroll \{/
  );
  assert.match(css, /scrollbar-gutter: stable;/);
  assert.match(css, /scroll-padding-block: 0\.75rem;/);
});
