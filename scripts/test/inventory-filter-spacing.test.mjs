import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("Inventory toolbar filter chevrons have their own flex slot separate from label text", () => {
  const page = read("frontend/src/pages/InventoryPage.tsx");
  const toolbar = page.slice(page.indexOf("function FilterSelect("), page.indexOf("function InventoryTable("));

  assert.match(toolbar, /<Select[\s\S]*?style=\{\{ backgroundImage: "none" \}\}/);
  assert.match(toolbar, /className="h-auto w-full min-w-0 flex-1/);
  assert.match(toolbar, /<ChevronDown[\s\S]*?pointer-events-none h-4 w-4 shrink-0/);
  assert.match(toolbar, /gap-3 rounded-md/);
  assert.doesNotMatch(toolbar, /pr-7/);
  assert.match(page, /minWidthClassName="min-w-\[190px\]"/);
  assert.match(page, /minWidthClassName="min-w-\[198px\]"/);
  assert.match(page, /minWidthClassName="min-w-\[220px\]"/);
});

test("Inventory chevron remains readable in dark mode without altering shared selects", () => {
  const css = read("frontend/src/styles/theme-retail.css");
  const sharedSelect = read("frontend/src/components/ui/select.tsx");

  assert.match(css, /:root\.dark \.app-shell-ambient \.ys-inventory-filter-chevron/);
  assert.match(css, /color: #cbd8ef !important;/);
  assert.match(sharedSelect, /backgroundImage: SELECT_CHEVRON_BACKGROUND/);
});
