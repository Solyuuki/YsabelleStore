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

test("checkout dark background reuses the approved Cart galaxy, not the stretched velvet shader", () => {
  const base = read("frontend/src/styles/theme-storefront.css");
  const contrast = read("frontend/src/styles/theme-storefront-contrast.css");
  const cart = read("frontend/src/styles/customer-cart-premium.css");
  const checkout = read("frontend/src/pages/customer/CheckoutPage.tsx");
  const qa = read("tools/mobile-qa/run.mjs");

  // The old broad dark-mode rule assigned a cover-scaled bitmap to Checkout.
  const oldBackground = base
    .split("/* Homepage and catalog: quiet midnight blue")[1]
    ?.split("/* Text inherits the semantic theme tokens")[0];
  assert.ok(oldBackground, "Could not locate the old storefront background group");
  assert.doesNotMatch(oldBackground, /\.customer-checkout-page/);

  const newBackground = contrast
    .split("/* Checkout dark canvas: reuse the approved Storefront/Cart galaxy")[1]
    ?.split("/* Checkout dark-mode completion: saved preferences")[0];
  assert.ok(newBackground, "Missing Checkout galaxy background override");
  assert.match(newBackground, /:root\.dark \.customer-app \.customer-checkout-page\s*\{/);
  assert.match(newBackground, /background-color: #101827 !important;/);
  assert.match(newBackground, /var\(--storefront-galaxy-background\) !important;/);
  assert.match(newBackground, /background-size: auto !important;/);
  assert.match(newBackground, /background-repeat: no-repeat !important;/);
  assert.doesNotMatch(newBackground, /ys-dark-midnight-velvet|\/ cover/);
  assert.match(
    cart,
    /:root\.dark \.customer-app \.customer-cart-page\s*\{[^}]*background-color: #101827 !important;[\s\S]*?var\(--storefront-galaxy-background\) !important;/
  );

  // Do not change payment options, selected-state surfaces, or route markup.
  assert.match(checkout, /className="customer-page customer-checkout-page"/);
  assert.match(checkout, /checked=\{paymentMethod === "PAYMONGO"\}/);
  assert.match(checkout, /checked=\{paymentMethod === "CASH_ON_DELIVERY"\}/);
  assert.match(checkout, /checked=\{orderPolicyAccepted\}/);
  assert.match(qa, /async function checkCheckoutDarkBackground\(page, viewport\)/);
  assert.match(qa, /Checkout still uses a stretched or mismatched dark background/);
});
