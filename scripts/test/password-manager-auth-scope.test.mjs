import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

const customerAccount = read("frontend/src/pages/customer/CustomerAccountPage.tsx");
const customerLogin = read("frontend/src/pages/customer/CustomerLoginPage.tsx");
const customerRegister = read("frontend/src/pages/customer/CustomerRegisterPage.tsx");
const customerRecovery = read("frontend/src/pages/customer/CustomerAccountRecoveryPage.tsx");
const customerEmailAuth = read("frontend/src/components/customer/CustomerEmailAuthPanel.tsx");
const customerVerificationCode = read(
  "frontend/src/components/customer/CustomerVerificationCode.tsx"
);
const staffLogin = read("frontend/src/pages/WelcomePage.tsx");
const staffAutofillGuard = read("frontend/src/utils/developmentStaffLoginAutofillGuard.ts");

test("customer credential forms use an isolated password-manager section", () => {
  for (const source of [
    customerAccount,
    customerLogin,
    customerRegister,
    customerRecovery,
    customerEmailAuth,
    customerVerificationCode
  ]) {
    assert.doesNotMatch(source, /autoComplete="section-staff/);
  }

  assert.match(customerAccount, /autoComplete="section-customer username"/);
  assert.match(customerAccount, /autoComplete="section-customer current-password"/);
  assert.match(customerAccount, /autoComplete="section-customer new-password"/);
  assert.match(customerLogin, /autoComplete="section-customer username"/);
  assert.match(customerLogin, /autoComplete="section-customer current-password"/);
  assert.match(customerRegister, /autoComplete="section-customer new-password"/);
  assert.match(customerRecovery, /autoComplete="section-customer new-password"/);
  assert.match(customerEmailAuth, /autoComplete="section-customer email"/);
  assert.match(customerVerificationCode, /autoComplete="section-customer one-time-code"/);
});

test("staff credentials stay in a separate password-manager section", () => {
  assert.match(staffLogin, /autoComplete="section-staff username"/);
  assert.match(staffLogin, /autoComplete="section-staff current-password"/);
  assert.doesNotMatch(staffLogin, /autoComplete="section-customer/);

  assert.match(staffAutofillGuard, /autocomplete~="section-staff"/);
  assert.match(staffAutofillGuard, /autocomplete~="current-password"/);
  assert.match(staffAutofillGuard, /section-staff new-password/);
  assert.match(staffAutofillGuard, /section-staff current-password/);
});

test("customer password update exposes the signed-in customer identity to password managers", () => {
  assert.match(customerAccount, /aria-label="Customer account email"/);
  assert.match(customerAccount, /name="username"/);
  assert.match(customerAccount, /value=\{customer\.email\}/);
  assert.match(customerAccount, /onChange=\{\(\) => undefined\}/);
  assert.doesNotMatch(
    customerAccount,
    /autoComplete="section-customer username"[\s\S]{0,220}readOnly/
  );
});
