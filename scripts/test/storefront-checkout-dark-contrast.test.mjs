import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("checkout dark-mode contrast covers preference and payment choice states", () => {
  const css = read("frontend/src/styles/theme-storefront-contrast.css");
  const checkout = read("frontend/src/pages/customer/CheckoutPage.tsx");

  assert.match(css, /\/\* Checkout dark-mode completion: saved preferences and payment choices/);
  assert.match(css, /:root\.dark \.customer-app \.customer-checkout-page/);
  assert.match(css, /--checkout-choice-ink: #f0f4ff/);
  assert.match(css, /--checkout-choice-body: #c4d2e8/);

  for (const selector of [
    ".customer-profile-default-option",
    ".customer-address-save-option",
    ".customer-address-save-checkbox",
    ".customer-payment-option",
    ".customer-payment-option.is-selected",
    ".customer-payment-option:has(input:disabled)",
    ".customer-payment-option > span strong",
    ".customer-payment-option > span small",
    ".customer-payment-option > svg",
    ".customer-checkout-saved-phone",
    ".customer-order-summary__payment"
  ]) {
    assert.ok(css.includes(selector), `Missing checkout contrast rule: ${selector}`);
  }

  assert.match(checkout, /onCheckedChange=\{setSaveContactPhoneToAccount\}/);
  assert.match(checkout, /onCheckedChange=\{setSaveAddressToAccount\}/);
  assert.match(checkout, /onChange=\{\(\) => setPaymentMethod\("PAYMONGO"\)\}/);
  assert.match(checkout, /onChange=\{\(\) => setPaymentMethod\("CASH_ON_DELIVERY"\)\}/);
});
