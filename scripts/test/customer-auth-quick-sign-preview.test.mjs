import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("customer auth exposes Phase 7 Google and Email OTP Quick Sign actions", () => {
  const login = read("frontend/src/pages/customer/CustomerLoginPage.tsx");
  const register = read("frontend/src/pages/customer/CustomerRegisterPage.tsx");
  const buttons = read("frontend/src/components/customer/CustomerSocialAuthButtons.tsx");
  const css = read("frontend/src/styles/customer-auth-quick-sign.css");

  for (const page of [login, register]) {
    assert.match(page, /import "@\/styles\/customer-auth-quick-sign\.css";/);
    assert.match(page, /CustomerSocialAuthButtons/);
    assert.match(page, /className="customer-auth-quick-divider"/);
    assert.doesNotMatch(page, /Coming soon/i);
    assert.doesNotMatch(page, /Available in Phase 7/i);
    assert.doesNotMatch(page, /Continue with Facebook/i);
    assert.doesNotMatch(page, /onMobileStart/);
  }

  assert.match(buttons, /aria-label="Quick sign-in options"/);
  assert.match(buttons, /onClick=\{\(\) => onStart\("google"\)\}/);
  assert.match(buttons, /Continue with Google/);
  assert.match(buttons, /Opening Google\.\.\./);
  assert.match(buttons, /Continue with Email OTP/i);
  assert.match(buttons, /onEmailStart/);
  assert.doesNotMatch(buttons, /Continue with Mobile OTP/i);
  assert.doesNotMatch(buttons, /onMobileStart/);
  assert.doesNotMatch(buttons, /Available in Phase 7/i);
  assert.doesNotMatch(buttons, /Continue with Facebook/i);

  assert.doesNotMatch(login, /CustomerMobileAuthPanel/);
  assert.doesNotMatch(login, /onMobileStart/);
  assert.doesNotMatch(register, /CustomerMobileAuthPanel/);
  assert.doesNotMatch(register, /CustomerMobileRegistrationPanel/);
  assert.match(register, /CustomerEmailRegistrationPanel/);

  assert.match(
    css,
    /\.customer-social-auth__button\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*auto minmax\(0, 1fr\);/
  );
  assert.match(css, /\.customer-social-auth__button:focus-visible\s*\{/);
});
