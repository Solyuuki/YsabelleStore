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
  assert.match(recoveryPage, /\{ label: "Identify", step: 1 \}/);
  assert.match(recoveryPage, /\{ label: "Verify", step: 2 \}/);
  assert.match(recoveryPage, /\{ label: "Secure", step: 3 \}/);
  assert.match(recoveryPage, /<span>\{label\}<\/span>/);

  assert.match(recoveryCss, /\.customer-recovery-progress\s*\{/);
  assert.match(recoveryCss, /\.customer-recovery-progress__step--active/);
  assert.match(recoveryCss, /backdrop-filter:\s*blur\(/);
  assert.doesNotMatch(recoveryCss, /emerald|#10b981|#059669|#047857/i);
});

test("verification code uses six real visual slots instead of spacing one text input over fake columns", () => {
  assert.match(recoveryPage, /customer-recovery-code-slots/);
  assert.match(recoveryPage, /Array\.from\(\{ length: 6 \}/);
  assert.match(recoveryPage, /verificationCode\[index\]/);
  assert.match(recoveryPage, /customer-recovery-code-slot--filled/);
  assert.match(recoveryPage, /aria-label="6-digit verification code"/);

  assert.match(recoveryCss, /\.customer-recovery-code-slots\s*\{/);
  assert.match(recoveryCss, /grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(recoveryCss, /\.customer-recovery-code-slot\s*\{/);
  assert.match(recoveryCss, /\.customer-recovery-code-input\s*\{[\s\S]*opacity:\s*0;/);
  assert.doesNotMatch(recoveryCss, /repeating-linear-gradient/);
});

test("premium OTP slots keep empty cells visually quiet and emphasize the active cell", () => {
  assert.match(recoveryPage, /customer-recovery-code-slot--empty/);
  assert.doesNotMatch(recoveryPage, /digit \|\| "0"/);
  assert.match(recoveryPage, /digit \? digit : null/);

  assert.match(recoveryCss, /\.customer-recovery-code-shell::before/);
  assert.match(recoveryCss, /\.customer-recovery-code-slot--empty::after/);
  assert.match(recoveryCss, /\.customer-recovery-code-slot--active/);
  assert.match(recoveryCss, /linear-gradient\(135deg,\s*#168cff/);
});
