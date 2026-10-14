import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(new URL("../../" + file, import.meta.url), "utf8");

test("all customer auth routes share the compact stylesheet without changing form handlers", () => {
  const frame = read("frontend/src/components/customer/CustomerAuthFrame.tsx");
  const login = read("frontend/src/pages/customer/CustomerLoginPage.tsx");
  const register = read("frontend/src/pages/customer/CustomerRegisterPage.tsx");
  const recovery = read("frontend/src/pages/customer/CustomerAccountRecoveryPage.tsx");
  const email = read("frontend/src/components/customer/CustomerEmailAuthPanel.tsx");
  const known = read("frontend/src/components/customer/CustomerKnownAccounts.tsx");

  assert.match(frame, /import "@\/styles\/customer-auth-compact\.css";/);
  assert.ok(
    frame.indexOf("customer-auth-compact.css") > frame.indexOf("customer-auth-login-premium.css")
  );
  assert.match(login, /<CustomerAuthFrame mode="login"/);
  assert.match(register, /<CustomerAuthFrame mode="register"/);
  assert.match(recovery, /<CustomerAuthFrame mode="recovery"/);
  assert.match(login, /await login\(/);
  assert.match(register, /await register\(/);
  assert.match(recovery, /await requestCustomerPasswordRecovery\(/);
  assert.match(email, /<CustomerVerificationCode/);
  assert.match(known, /await continueCustomerRememberedAccount\(/);
});

test("mobile auth compresses text and spaces without hiding actions or inputs", () => {
  const css = read("frontend/src/styles/customer-auth-compact.css");
  const mobile = css.split("@media (max-width: 700px) {")[1];
  assert.ok(mobile, "Missing compact phone breakpoint");
  assert.match(mobile, /\.customer-auth-page--phase3\s*\{[^}]*padding: 0\.7rem 0\.65rem 2rem;/);
  assert.match(
    mobile,
    /\.customer-auth-stage__panel[\s\S]*?padding: clamp\(0\.85rem, 3\.8vw, 1\.25rem\);/
  );
  assert.match(
    mobile,
    /\.customer-auth-card__intro > h1\s*\{[^}]*font-size: clamp\(1\.55rem, 6vw, 2rem\);/
  );
  assert.match(
    mobile,
    /\.customer-auth-form--register\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\);/
  );
  assert.match(mobile, /\.customer-auth-field input[\s\S]*?min-height: 44px;/);
  assert.match(
    mobile,
    /\.customer-auth-stage__panel \.customer-auth-submit\s*\{[^}]*min-height: 44px;/
  );
  assert.match(mobile, /\.customer-social-auth__button\s*\{[^}]*min-height: 46px;/);
  assert.match(
    mobile,
    /\.customer-social-auth__button > span:last-child small\s*\{\s*display: none;/
  );
  assert.match(mobile, /\.customer-auth-card:has\(> \.customer-known-accounts\)/);
  assert.match(mobile, /\.customer-recovery-progress\s*\{[^}]*margin-bottom: 0\.8rem;/);
  assert.match(mobile, /\.customer-email-quick-sign__intro h2\s*\{[^}]*white-space: normal;/);
  assert.doesNotMatch(mobile, /overflow-y:\s*hidden/);
});

test("secondary navigation and saved account text stay legible in desktop and phone dark mode", () => {
  const css = read("frontend/src/styles/customer-auth-compact.css");
  assert.match(
    css,
    /:root\.dark \.customer-app \.customer-auth-page \.customer-auth-card \.customer-mobile-auth__back/
  );
  assert.match(
    css,
    /\.customer-email-quick-sign\.customer-mobile-auth \.customer-email-quick-sign__back/
  );
  assert.match(css, /color: #dce6fa;/);
  assert.match(css, /\.customer-known-account__identity :is\(span, small\)/);
  assert.match(css, /color: #cedbef;/);
  assert.match(
    css,
    /\.customer-recovery-progress__step:not\(\.customer-recovery-progress__step--active\)/
  );
  assert.match(css, /\.customer-auth-page \.customer-mobile-auth__back:focus-visible/);
  assert.match(css, /outline: 2px solid #b9a7ff;/);
});
