import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("cart offers a clickable order cancellation policy before checkout", () => {
  const cart = read("frontend/src/pages/customer/CartPage.tsx");
  const disclosure = read("frontend/src/components/customer/CustomerOrderPolicyInfo.tsx");

  assert.match(cart, /<CustomerOrderPolicyInfo \/>/);
  assert.ok(cart.indexOf("<CustomerOrderPolicyInfo />") < cart.indexOf("Proceed to checkout"));
  assert.match(disclosure, /<details className="customer-order-policy">/);
  assert.match(disclosure, /<summary className="customer-order-policy__trigger">/);
  assert.match(disclosure, /cannot cancel it directly from your account/);
  assert.match(disclosure, /Contact the\s+store to request a cancellation/);
});

test("only new storefront orders require explicit acceptance before order creation", () => {
  const checkout = read("frontend/src/pages/customer/CheckoutPage.tsx");

  assert.match(checkout, /const \[orderPolicyAccepted, setOrderPolicyAccepted\] = useState\(false\)/);
  assert.match(checkout, /if \(!pendingPaymongoOrder && !orderPolicyAccepted\)/);
  assert.match(checkout, /checked=\{orderPolicyAccepted\}/);
  assert.match(checkout, /required\s+type="checkbox"/);
  assert.match(checkout, /\{!pendingPaymongoOrder \? \(/);
  assert.match(checkout, /<CustomerOrderPolicyInfo \/>/);
  assert.ok(checkout.indexOf("!orderPolicyAccepted") < checkout.indexOf("placeStorefrontOrder({"));
  assert.match(checkout, /Retry PayMongo checkout/);
});

test("order policy stays readable in light and dark storefront themes", () => {
  const customerApp = read("frontend/src/app/CustomerApp.tsx");
  const css = read("frontend/src/styles/customer-order-policy.css");

  assert.match(customerApp, /import "@\/styles\/customer-order-policy\.css";/);
  assert.match(css, /\.customer-app \.customer-order-policy__trigger/);
  assert.match(css, /:root\.dark \.customer-app \.customer-order-policy/);
  assert.match(css, /:root\.dark \.customer-app \.customer-order-agreement__checkbox/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
});
