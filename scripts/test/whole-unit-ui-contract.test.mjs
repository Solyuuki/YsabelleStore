import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");

test("Storefront quantity input rejects fractions at the component boundary", () => {
  const control = read("frontend/src/components/customer/QuantityControl.tsx");
  const cart = read("frontend/src/context/CartContext.tsx");
  const helper = read("frontend/src/utils/wholeUnitQuantity.ts");
  assert.match(control, /parseWholeUnitQuantity\(event\.target\.value\)/);
  assert.match(control, /nextValue === null/);
  assert.match(control, /pattern="\[0-9\]\*"/);
  assert.match(control, /type="text"/);
  assert.match(cart, /parseWholeUnitQuantity\(quantity\)/);
  assert.doesNotMatch(cart, /Math\.round\(quantity\)/);
  assert.match(helper, /Number\.isSafeInteger/);
  assert.doesNotMatch(helper, /Math\.(round|trunc|floor)\(/);
  const css = read("frontend/src/styles/theme-storefront-contrast.css");
  assert.match(css, /\.customer-shop-page \.customer-quantity > input \{/);
});

test("Both receiving paths reject fractional input instead of truncating before API submit", () => {
  const receiving = read("frontend/src/pages/ReceivingPage.tsx");
  const reports = read("frontend/src/components/reports/RestockReceivingPanel.tsx");
  for (const [name, src] of [["Receiving page", receiving], ["Reports receiving", reports]]) {
    assert.doesNotMatch(src, /Math\.trunc\(/, name + " still has silent truncation");
    assert.match(src, /requireWholeUnitQuantity\(/);
    assert.match(src, /parseWholeUnitQuantity\(/);
    assert.match(src, /pattern="\[0-9\]\*"/);
    assert.match(src, /type="text"/);
  }
  assert.match(receiving, /isWholeUnitDraft\(event\.target\.value\)/);
  assert.match(reports, /if \(!isWholeUnitDraft\(value\)\) return/);
});

test("Restock and Owner quantity fields reject fractions but monetary inputs are unaffected", () => {
  const planner = read("frontend/src/components/reports/RestockPlanningPanel.tsx");
  const inventory = read("frontend/src/pages/InventoryPage.tsx");
  const imported = read("frontend/src/components/inventory/InventoryImportDialog.tsx");
  const products = read("frontend/src/pages/ProductsPageLegacy.tsx");
  const cash = read("frontend/src/components/pos/CashPaymentDialog.tsx");
  assert.doesNotMatch(planner, /Math\.trunc\(/);
  assert.match(planner, /parseWholeUnitQuantity\(event\.target\.value\)/);
  assert.ok(planner.split('pattern="[0-9]*"').length >= 4);
  assert.match(inventory, /id="adjustment-quantity"/);
  assert.match(inventory, /if \(!\/\^\\d\*\$\/\.test\(event\.target\.value\)\) return/);
  assert.ok(imported.split("isWholeUnitDraft(event.target.value)").length >= 3);
  assert.ok(products.split("isWholeUnitDraft(event.target.value)").length >= 5);
  assert.match(cash, /inputMode="decimal"/);
  assert.match(products, /id="product-cost"/);
  assert.match(products, /id="product-sell"/);
  assert.match(products, /inputMode="decimal"/);
});
