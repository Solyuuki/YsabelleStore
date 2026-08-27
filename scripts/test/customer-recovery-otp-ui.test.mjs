import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const recoveryPage = fs.readFileSync(
  path.join(REPO_ROOT, "frontend", "src", "pages", "customer", "CustomerAccountRecoveryPage.tsx"),
  "utf8"
);
const recoveryCss = fs.readFileSync(
  path.join(REPO_ROOT, "frontend", "src", "styles", "customer-auth-recovery.css"),
  "utf8"
);
const authService = fs.readFileSync(
  path.join(REPO_ROOT, "frontend", "src", "services", "customerAuthService.ts"),
  "utf8"
);

test("customer recovery UI uses a verification-code stage without URL reset tokens", () => {
  assert.match(recoveryPage, /type RecoveryStage = "identify" \| "verify" \| "reset" \| "complete"/);
  assert.match(recoveryPage, /autoComplete="one-time-code"/);
  assert.match(recoveryPage, /Enter verification code/);
  assert.match(recoveryPage, /Resend code/);
  assert.doesNotMatch(recoveryPage, /searchParams\.get\("token"\)/);
  assert.doesNotMatch(recoveryPage, /Send recovery link/);
});

test("customer auth client verifies OTP and resets password through cookie-backed grant", () => {
  assert.match(authService, /verifyCustomerPasswordRecoveryCode/);
  assert.match(authService, /\/api\/customer-auth\/recovery\/verify/);
  assert.match(authService, /verificationCode/);
  assert.match(authService, /resetCustomerPassword\(input:\s*\{\s*newPassword:\s*string\s*\}\)/s);
  assert.doesNotMatch(authService, /resetCustomerPassword\(input:\s*\{[\s\S]*?token:\s*string/s);
});

test("customer recovery presents a premium three-step security flow", () => {
  assert.match(recoveryPage, /aria-label="Recovery progress"/);
  assert.match(recoveryPage, /customer-recovery-progress__step/);
  assert.match(recoveryPage, />Identify</);
  assert.match(recoveryPage, />Verify</);
  assert.match(recoveryPage, />Secure</);

  assert.match(recoveryCss, /\.customer-recovery-progress\s*\{/);
  assert.match(recoveryCss, /\.customer-recovery-progress__step--active/);
  assert.match(recoveryCss, /backdrop-filter:\s*blur\(/);
  assert.match(recoveryCss, /\.customer-recovery-code-input\s*\{[\s\S]*letter-spacing:/);
  assert.match(recoveryCss, /repeating-linear-gradient/);
  assert.doesNotMatch(recoveryCss, /emerald|#10b981|#059669|#047857/i);
});
