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
  assert.match(
    mobile,
    /\.customer-auth-page--phase3\s*\{[^}]*padding:\s*0\.7rem\s*0\.65rem\s*2rem;/
  );
  assert.match(
    mobile,
    /\.customer-auth-stage__panel[\s\S]*?padding:\s*clamp\(0\.85rem,\s*\s*3\.8vw,\s*\s*1\.25rem\);/
  );
  assert.match(
    mobile,
    /\.customer-auth-card__intro\s*>\s*h1\s*\{[^}]*font-size:\s*clamp\(1\.55rem,\s*\s*6vw,\s*\s*2rem\);/
  );
  assert.match(
    mobile,
    /\.customer-auth-form--register\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*\s*1fr\);/
  );
  assert.match(mobile, /\.customer-auth-field\s*input[\s\S]*?min-height:\s*44px;/);
  assert.match(
    mobile,
    /\.customer-auth-stage__panel\s*\.customer-auth-submit\s*\{[^}]*min-height:\s*44px;/
  );
  assert.match(mobile, /\.customer-social-auth__button\s*\{[^}]*min-height:\s*46px;/);
  assert.match(
    mobile,
    /\.customer-social-auth__button\s*>\s*span:last-child\s*small\s*\{\s*display:\s*none;/
  );
  assert.match(mobile, /\.customer-auth-card:has\(>\s*\.customer-known-accounts\)/);
  assert.match(mobile, /\.customer-recovery-progress\s*\{[^}]*margin-bottom:\s*0\.8rem;/);
  assert.match(mobile, /\.customer-email-quick-sign__intro\s*h2\s*\{[^}]*white-space:\s*normal;/);
  assert.doesNotMatch(mobile, /overflow-y:\s*hidden/);
});

test("secondary navigation and saved account text stay legible in desktop and phone dark mode", () => {
  const css = read("frontend/src/styles/customer-auth-compact.css");
  assert.match(
    css,
    /:root\.dark\s*\.customer-app\s*\.customer-auth-page\s*\.customer-auth-card\s*\.customer-mobile-auth__back/
  );
  assert.match(
    css,
    /\.customer-email-quick-sign\.customer-mobile-auth\s*\.customer-email-quick-sign__back/
  );
  assert.match(css, /color:\s*#dce6fa;/);
  assert.match(css, /\.customer-known-account__identity\s*:is\(span,\s*\s*small\)/);
  assert.match(css, /color:\s*#cedbef;/);
  assert.match(
    css,
    /\.customer-recovery-progress__step:not\(\.customer-recovery-progress__step--active\)/
  );
  assert.match(css, /\.customer-auth-page\s*\.customer-mobile-auth__back:focus-visible/);
  assert.match(css, /outline:\s*2px\s*solid\s*#b9a7ff;/);
});
