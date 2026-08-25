import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

function extractTypeBlock(source, typeName) {
  const match = source.match(new RegExp(`export type ${typeName}\\s*=\\s*\\{([\\s\\S]*?)\\n\\};`));
  assert.ok(match, `${typeName} must remain an exported object type`);
  return match[1];
}

test("customer auth types expose username and use identifier instead of login email", () => {
  const types = read("frontend/src/types/customerAuth.ts");
  const customer = extractTypeBlock(types, "Customer");
  const loginInput = extractTypeBlock(types, "CustomerLoginInput");
  const registerInput = extractTypeBlock(types, "CustomerRegisterInput");

  assert.match(customer, /username:\s*string\s*\|\s*null\s*;/);
  assert.match(loginInput, /identifier:\s*string\s*;/);
  assert.doesNotMatch(loginInput, /\bemail\s*:/);
  assert.match(registerInput, /username:\s*string\s*;/);
  assert.doesNotMatch(registerInput, /confirmPassword\s*:/);
});

test("customer login page submits a generic username, email, or mobile identifier", () => {
  const loginPage = read("frontend/src/pages/customer/CustomerLoginPage.tsx");

  assert.match(loginPage, /const\s*\[identifier\s*,\s*setIdentifier\]\s*=\s*useState\(["']{2}\)/);
  assert.match(loginPage, /Username, email or mobile number/);
  assert.match(loginPage, /autoComplete=["']username["']/);
  assert.match(loginPage, /validateCustomerLoginForm\(\{\s*identifier\s*,\s*password\s*\}\)/);
  assert.match(loginPage, /await login\(\{\s*identifier:\s*identifier\.trim\(\)\s*,\s*password\s*\}\)/);
  assert.doesNotMatch(loginPage, /type=["']email["']/);
});

test("customer registration page adds username and confirm password without transmitting confirmation", () => {
  const registerPage = read("frontend/src/pages/customer/CustomerRegisterPage.tsx");

  assert.match(registerPage, />\s*Username\s*</);
  assert.match(registerPage, /autoComplete=["']username["']/);
  assert.match(registerPage, />\s*Confirm password\s*</i);
  assert.match(registerPage, /confirmPassword/);

  const registerCall = registerPage.match(/await register\(\{([\s\S]*?)\}\);/);
  assert.ok(registerCall, "registration page must submit through the customer auth context");
  assert.match(registerCall[1], /username:/);
  assert.doesNotMatch(registerCall[1], /confirmPassword/);
});

test("customer registration intent prewarm remains part of the registration flow", () => {
  const service = read("frontend/src/services/customerAuthService.ts");
  const registerPage = read("frontend/src/pages/customer/CustomerRegisterPage.tsx");

  assert.match(service, /export async function prepareCustomerRegistrationIntent\s*\(/);
  assert.match(service, /registerCustomer[\s\S]*?await ensureCustomerRegistrationIntentReady\s*\(\s*\)/);
  assert.match(registerPage, /useEffect\s*\(\s*\(\s*\)\s*=>[\s\S]*?prepareCustomerRegistrationIntent/);
});

test("Phase 2 customer auth pages do not introduce OAuth or OTP controls", () => {
  const loginPage = read("frontend/src/pages/customer/CustomerLoginPage.tsx");
  const registerPage = read("frontend/src/pages/customer/CustomerRegisterPage.tsx");
  const combined = `${loginPage}\n${registerPage}`;

  assert.doesNotMatch(combined, /\bGoogle\b|\bFacebook\b|\bOAuth\b|\bOTP\b|one[- ]time code|verification code/i);
});
