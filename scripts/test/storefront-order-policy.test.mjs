import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("cart policy badge is above the summary card and opens a centered modal", () => {
  const cart = read("frontend/src/pages/customer/CartPage.tsx");
  const policy = read("frontend/src/components/customer/CustomerOrderPolicyInfo.tsx");

  assert.match(cart, /<div className="customer-cart-summary-stack">/);
  assert.ok(
    cart.indexOf("<CustomerOrderPolicyInfo />") <
      cart.indexOf('<aside className="customer-order-summary">')
  );
  assert.ok(
    cart.indexOf('<aside className="customer-order-summary">') <
      cart.indexOf("Proceed to checkout")
  );
  assert.match(policy, /<Dialog>/);
  assert.match(policy, /<DialogTrigger asChild>/);
  assert.match(policy, /<DialogContent className="customer-order-policy__dialog">/);
  assert.match(policy, /<DialogTitle/);
  assert.match(policy, /<DialogDescription/);
  assert.match(policy, /<DialogClose asChild>/);
  assert.match(policy, /type="button"/);
  assert.doesNotMatch(policy, /<details\b|<summary\b/);
  assert.match(policy, /cannot cancel it directly from My Account/);
  assert.match(policy, /contact the store to request a cancellation/);
});

test("only new storefront orders require explicit acceptance before order creation", () => {
  const checkout = read("frontend/src/pages/customer/CheckoutPage.tsx");

  assert.match(
    checkout,
    /const \[orderPolicyAccepted, setOrderPolicyAccepted\] = useState\(false\)/
  );
  assert.match(checkout, /if \(!pendingPaymongoOrder && !orderPolicyAccepted\)/);
  assert.match(checkout, /checked=\{orderPolicyAccepted\}/);
  assert.match(checkout, /required\s+type="checkbox"/);
  assert.match(checkout, /\{!pendingPaymongoOrder \? \(/);
  assert.match(checkout, /<CustomerOrderPolicyInfo \/>/);
  assert.ok(checkout.indexOf("!orderPolicyAccepted") < checkout.indexOf("placeStorefrontOrder({"));
  assert.match(checkout, /Retry PayMongo checkout/);
});

test("policy popup is viewport-centered, scroll-safe and supports light/dark themes", () => {
  const app = read("frontend/src/app/CustomerApp.tsx");
  const css = read("frontend/src/styles/customer-order-policy.css");

  assert.match(app, /import "@\/styles\/customer-order-policy\.css";/);
  assert.match(css, /\.customer-cart-page \.customer-cart-summary-stack/);
  assert.match(css, /gap: 0;/);
  assert.match(css, /margin: 0 0 -1px;/);
  assert.match(css, /border-top-left-radius: 0;/);
  assert.match(css, /border-bottom-right-radius: 0;/);
  assert.match(css, /border-bottom-left-radius: 0;/);
  assert.match(css, /body \.customer-order-policy__dialog/);
  assert.match(css, /max-height: calc\(100dvh - 32px\)/);
  assert.match(css, /overflow-y: auto/);
  assert.match(css, /:root\.dark body \.customer-order-policy__dialog/);
  assert.match(css, /:root\.dark \.customer-app \.customer-order-agreement/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 480px\)/);
});
