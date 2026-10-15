import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const checkout = source("src/pages/customer/CheckoutPage.tsx");
const account = source("src/pages/customer/CustomerAccountPage.tsx");
const deliveries = source("src/pages/DeliveriesPage.tsx");
const commerceCss = source("src/styles/customer-commerce-premium.css");
const accountCss = source("src/styles/customer-account-premium.css");

assert.match(checkout, /import \{ ScrollArea \} from "@\/components\/ui\/scroll-area"/);
assert.match(checkout, /customer-checkout-scroll-area/);
assert.match(checkout, /customer-checkout-scroll-area__content/);
assert.match(commerceCss, /customer-checkout-scroll-area__viewport/);
assert.match(commerceCss, /\.customer-form-grid \{\s*align-items: start;/);

assert.match(account, /<DeliveryProgress order=\{order\} \/>/);
assert.match(account, /<details className="customer-account-history-card"/);
assert.match(accountCss, /\.customer-delivery-stepper/);
assert.match(accountCss, /\.customer-account-history-card/);

assert.match(deliveries, /Other courier \/ service name/);
assert.match(deliveries, /Booking reference \(optional\)/);
assert.match(deliveries, /Booking ID is separate from rider phone\./);
assert.match(deliveries, /Rider phone number \(required to dispatch\)/);
assert.match(deliveries, /Customer delivery note/);
assert.match(deliveries, /Internal delivery note/);
assert.match(deliveries, /Owner &amp; Staff/);
assert.match(deliveries, /Payment received/);
assert.match(deliveries, /<StaffDeliveryProgress ticket=\{selected\} \/>/);

console.log("Premium delivery UI contract passed.");
