import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("customer registration client prepares an intent before posting account data", () => {
  const service = read("frontend/src/services/customerAuthService.ts");
  const registerPage = read("frontend/src/pages/customer/CustomerRegisterPage.tsx");

  assert.match(
    service,
    /export async function prepareCustomerRegistrationIntent\s*\(/,
    "customer auth service must expose registration-intent preparation"
  );
  assert.match(
    service,
    /["']\/api\/customer-auth\/registration-intent["']/,
    "customer auth service must call the registration-intent endpoint"
  );
  assert.match(
    service,
    /registerCustomer[\s\S]*?await ensureCustomerRegistrationIntentReady\s*\(\s*\)/,
    "registration must ensure the intent has reached the server minimum age before POST"
  );
  assert.match(
    registerPage,
    /prepareCustomerRegistrationIntent/,
    "registration page should prewarm the intent so normal users do not wait at submit time"
  );
  assert.match(
    registerPage,
    /useEffect\s*\(\s*\(\s*\)\s*=>[\s\S]*?prepareCustomerRegistrationIntent/,
    "registration page should prewarm the registration intent on mount"
  );
});
