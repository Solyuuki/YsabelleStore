import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("recovery keeps its approved OTP presentation while email quick sign uses the shared input", () => {
  const sharedPath = resolve(
    fileURLToPath(new URL("../..", import.meta.url)),
    "frontend/src/components/customer/CustomerVerificationCode.tsx"
  );
  assert.equal(existsSync(sharedPath), true, "shared verification-code component should exist");

  const shared = read("frontend/src/components/customer/CustomerVerificationCode.tsx");
  const recovery = read("frontend/src/pages/customer/CustomerAccountRecoveryPage.tsx");
  const email = read("frontend/src/components/customer/CustomerEmailAuthPanel.tsx");

  assert.match(shared, /InputOTP/);
  assert.match(shared, /InputOTPGroup/);
  assert.match(shared, /InputOTPSlot/);
  assert.match(email, /CustomerVerificationCode/);

  assert.doesNotMatch(recovery, /CustomerVerificationCode/);
  assert.match(recovery, /customer-recovery-code-shell/);
  assert.match(recovery, /customer-recovery-code-slots/);
  assert.match(recovery, /customer-recovery-code-slot--filled/);
  assert.match(recovery, /customer-recovery-code-slot--active/);
  assert.match(recovery, /customer-recovery-code-input/);
});

test("email quick sign shared verification UI keeps recovery-like proportions without replacing recovery markup", () => {
  const css = read("frontend/src/styles/customer-verification-code.css");

  assert.match(css, /width:\s*min\(100%, 31rem\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(css, /gap:\s*0\.72rem/);
  assert.match(css, /min-height:\s*72px/);
  assert.match(css, /font-size:\s*clamp\(1\.7rem, 4vw, 2\.05rem\)/);
  assert.match(css, /\.customer-verification-code__slot\[data-active="true"\]/);
});
