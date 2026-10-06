import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [accountPage, accountCss] = await Promise.all([
  readFile(
    new URL("../../frontend/src/pages/customer/CustomerAccountPage.tsx", import.meta.url),
    "utf8"
  ),
  readFile(new URL("../../frontend/src/styles/customer-account.css", import.meta.url), "utf8")
]);

test("customer account security fields expose password visibility toggles", () => {
  assert.match(accountPage, /Eye,/);
  assert.match(accountPage, /EyeOff,/);
  assert.match(accountPage, /function PasswordField/);
  assert.match(accountPage, /type=\{visible \? "text" : "password"\}/);
  assert.match(accountPage, /aria-pressed=\{visible\}/);
  assert.equal((accountPage.match(/<PasswordField/g) ?? []).length, 6);
  assert.match(accountPage, /onChange=\{setRevokePassword\}/);
  assert.match(accountPage, /revokeConfirmationOpen/);
  assert.match(accountPage, /No other active sessions/);
  assert.match(accountPage, /You’re only signed in on this session/);
  assert.match(accountPage, /Confirm it’s you/);
  assert.match(accountPage, /Confirm sign out/);
  assert.match(accountPage, /requestCustomerSessionRevokeVerification/);
  assert.match(accountPage, /verifyCustomerSessionRevokeVerification/);
  assert.match(accountPage, /Send verification code/);
  assert.match(accountPage, /Verify & sign out/);
  assert.equal((accountPage.match(/autoComplete="username"/g) ?? []).length, 3);
  assert.equal((accountPage.match(/value=\{customer\.email\}/g) ?? []).length, 3);
  assert.match(accountPage, /name="newPassword"/);
  assert.match(accountPage, /name="newPasswordConfirmation"/);
});

test("passwordless Quick Sign accounts get a verified set-password flow", () => {
  assert.match(accountPage, /fetchCustomerSecuritySummary/);
  assert.match(accountPage, /requestCustomerPasswordSetup/);
  assert.match(accountPage, /verifyCustomerPasswordSetup/);
  assert.match(accountPage, /setupCustomerPassword/);
  assert.match(accountPage, /securitySummary\?\.hasPassword/);
  assert.match(accountPage, /Set a password/);
  assert.match(accountPage, /Verification code/);
  assert.match(accountPage, /Enter the 6-digit code sent to your email/);
  assert.match(accountPage, /Code expires in/);
  assert.match(accountPage, /You can request a new code in/);
  assert.match(accountPage, /Resend code/);
  assert.match(accountPage, /PASSWORD_SETUP_RESEND_COOLDOWN_MS = 45 \* 1000/);
  assert.match(accountPage, /Quick Sign or your email and password/);
  assert.match(accountPage, /Forgot current password\?/);
  assert.match(accountPage, /navigate\("\/account-recovery"\)/);
  assert.match(accountPage, /Update password/);
  assert.match(accountPage, /Changing your password signs out your other sessions/);
});

test("password visibility buttons keep input layout and button styling isolated", () => {
  assert.match(accountCss, /\.customer-account-password-field\s*\{/);
  assert.match(accountCss, /padding-right:\s*3rem/);
  assert.match(accountCss, /\.customer-account-security-card \.customer-account-password-toggle/);
  assert.match(accountCss, /transform:\s*translateY\(-50%\)/);
  assert.match(accountCss, /\.customer-account-password-identity\s*\{/);
  assert.match(accountCss, /clip:\s*rect\(0 0 0 0\)/);
  assert.match(accountCss, /\.customer-account-auth-methods\s*\{/);
  assert.match(accountCss, /\.customer-account-otp-input\s*\{/);
  assert.match(accountCss, /\.customer-account-otp-timers\s*\{/);
  assert.match(accountCss, /\.customer-account-otp-actions\s*\{/);
  assert.match(accountCss, /\.customer-account-session-empty\s*\{/);
  assert.match(accountCss, /\.customer-account-session-confirm\s*\{/);
  assert.match(accountCss, /\.customer-account-session-confirm-actions\s*\{/);
  assert.match(accountCss, /\.customer-account-session-otp-actions\s*\{/);
  assert.match(accountCss, /\.customer-account-password-change-form\s*\{/);
  assert.match(accountCss, /\.customer-account-password-recovery-link\s*\{/);
  assert.match(accountCss, /\.customer-account-password-change-divider\s*\{/);
});
