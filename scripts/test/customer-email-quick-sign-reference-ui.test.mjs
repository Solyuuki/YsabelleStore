import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("Email Quick Sign is direct and does not render a decorative progress stepper", () => {
  const panel = read("frontend/src/components/customer/CustomerEmailAuthPanel.tsx");
  const css = read("frontend/src/styles/customer-email-quick-sign-reference.css");

  assert.match(panel, /customer-email-quick-sign/);
  assert.doesNotMatch(panel, /EmailQuickSignProgress/);
  assert.doesNotMatch(panel, /customer-email-quick-sign__progress/);
  assert.doesNotMatch(css, /\.customer-email-quick-sign__progress/);
  assert.match(panel, /customer-email-quick-sign__intro/);
  assert.match(panel, /Email Quick Sign/);
  assert.match(panel, /Sign in with email/);
  assert.match(panel, /Enter verification code/);
  assert.match(panel, /6-digit verification code/);
});

test("Email Quick Sign desktop headings stay on one line while remaining responsive", () => {
  const css = read("frontend/src/styles/customer-email-quick-sign-reference.css");

  assert.match(
    css,
    /\.customer-email-quick-sign__intro h2\s*\{[\s\S]*?max-width:\s*none;[\s\S]*?white-space:\s*nowrap;[\s\S]*?\}/
  );
  assert.match(
    css,
    /@media \(max-width:\s*560px\)[\s\S]*?\.customer-email-quick-sign__intro h2\s*\{[\s\S]*?white-space:\s*normal;/
  );
});

test("Email Quick Sign borrows Recovery proportions without importing Recovery UI", () => {
  const panel = read("frontend/src/components/customer/CustomerEmailAuthPanel.tsx");
  const css = read("frontend/src/styles/customer-email-quick-sign-reference.css");
  const recovery = read("frontend/src/pages/customer/CustomerAccountRecoveryPage.tsx");

  assert.doesNotMatch(panel, /customer-auth-recovery\.css/);
  assert.doesNotMatch(panel, /customer-recovery-/);
  assert.doesNotMatch(recovery, /CustomerVerificationCode/);

  assert.match(css, /\.customer-email-quick-sign\s*\{[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;[\s\S]*?box-shadow:\s*none;/);
  assert.match(css, /\.customer-email-quick-sign__intro h2\s*\{[\s\S]*?font-family:\s*var\(--customer-font-display\)/);
  assert.match(css, /\.customer-email-quick-sign__form\s*\{[\s\S]*?width:\s*min\(100%, 31rem\)/);
  assert.match(css, /\.customer-email-quick-sign__form > \.customer-auth-submit\s*\{[\s\S]*?min-height:\s*56px/);
});

test("Quick Sign OTP slots remain six full Recovery-proportion boxes", () => {
  const css = read("frontend/src/styles/customer-verification-code.css");

  assert.match(css, /\.customer-verification-code__group\s*\{[\s\S]*?display:\s*grid\s*!important;[\s\S]*?grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.customer-verification-code__slot\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-height:\s*72px/);
});

test("Email Quick Sign hides duplicate outer intro and switch only while its panel is present", () => {
  const css = read("frontend/src/styles/customer-email-quick-sign-reference.css");

  assert.match(
    css,
    /\.customer-auth-card:has\(> \.customer-email-quick-sign\) > \.customer-auth-card__intro/
  );
  assert.match(
    css,
    /\.customer-auth-card:has\(> \.customer-email-quick-sign\) > \.customer-auth-switch/
  );
  assert.match(css, /display:\s*none/);
});
