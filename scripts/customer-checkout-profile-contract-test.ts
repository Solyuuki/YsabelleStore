import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const checkout = source("src/pages/customer/CheckoutPage.tsx");
const profile = source("src/pages/customer/CustomerAccountPage.tsx");
const accountState = source("src/utils/customerAccountState.ts");
const customerApp = source("src/app/CustomerApp.tsx");

assert.match(checkout, /const value = event\.currentTarget\.value;/);
assert.doesNotMatch(
  checkout,
  /set(?:Contact|Address)\(\(current\)[\s\S]{0,120}?event\.currentTarget\.value/
);
assert.match(checkout, /saveContactPhoneToAccount/);
assert.match(checkout, /Save as my default contact number/);
assert.match(checkout, /Save as my default delivery address/);
assert.match(checkout, /Use a different number/);
assert.match(checkout, /Use a different address/);

assert.match(accountState, /customer\?\.defaultContactPhone \?\? customer\?\.phone/);

assert.doesNotMatch(profile, /claimCustomerUsername/);
assert.doesNotMatch(profile, /Claim username/);
assert.doesNotMatch(profile, /Choose username/);
assert.doesNotMatch(profile, /Legacy accounts can claim/);
assert.match(profile, /Default contact mobile/);
assert.match(profile, /Default delivery address/);
assert.match(profile, /customer-account-inline-action-form/);

assert.match(customerApp, /CustomerErrorBoundary/);
assert.match(customerApp, /resetKey=\{location\}/);

console.log("Customer checkout/profile runtime contract passed.");

assert.match(checkout, /customerPhone: contact\.customerPhone/);
assert.doesNotMatch(checkout, /customerPhone: String\(form\.get\("customerPhone"\)/);
assert.match(profile, /AppPagination/);
assert.match(profile, /paginatedHistoricalOrders/);
