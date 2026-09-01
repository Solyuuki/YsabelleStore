import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("recovery and email quick sign share one verification-code component", () => {
  const sharedPath = resolve(new URL("../..", import.meta.url).pathname, "frontend/src/components/customer/CustomerVerificationCode.tsx");
  assert.equal(existsSync(sharedPath), true, "shared verification-code component should exist");

  const shared = read("frontend/src/components/customer/CustomerVerificationCode.tsx");
  const recovery = read("frontend/src/pages/customer/CustomerAccountRecoveryPage.tsx");
  const email = read("frontend/src/components/customer/CustomerEmailAuthPanel.tsx");

  assert.match(shared, /InputOTP/);
  assert.match(shared, /InputOTPGroup/);
  assert.match(shared, /InputOTPSlot/);
  assert.match(shared, /Array\.from\(\{ length: 6 \}/);
  assert.match(shared, /customer-verification-code__slot/);
  assert.match(recovery, /CustomerVerificationCode/);
  assert.match(email, /CustomerVerificationCode/);
  assert.doesNotMatch(recovery, /customer-recovery-code-slots/);
  assert.doesNotMatch(email, /customer-email-otp__group/);
});

test("shared verification UI preserves recovery proportions", () => {
  const css = read("frontend/src/styles/customer-verification-code.css");

  assert.match(css, /width:\s*min\(100%, 31rem\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(css, /gap:\s*0\.72rem/);
  assert.match(css, /min-height:\s*72px/);
  assert.match(css, /font-size:\s*clamp\(1\.7rem, 4vw, 2\.05rem\)/);
  assert.match(css, /\.customer-verification-code__slot\[data-active="true"\]/);
});
