import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const recoveryEmailService = fs.readFileSync(
  path.join(REPO_ROOT, "backend", "src", "services", "customerRecoveryEmailService.ts"),
  "utf8"
);
const identityEmailService = fs.readFileSync(
  path.join(REPO_ROOT, "backend", "src", "services", "customerIdentityEmailDeliveryService.ts"),
  "utf8"
);

test("password recovery reuses the shared customer identity delivery path", () => {
  assert.match(
    recoveryEmailService,
    /sendCustomerIdentityVerificationEmail/
  );
  assert.match(recoveryEmailService, /purpose: "password_recovery"/);
  assert.match(
    recoveryEmailService,
    /error instanceof CustomerIdentityEmailDeliveryError/
  );
});

test("shared identity delivery supports development Gmail SMTP for recovery", () => {
  assert.match(identityEmailService, /"password_recovery"/);
  assert.match(identityEmailService, /CUSTOMER_DEV_GMAIL_SMTP_USER/);
  assert.match(identityEmailService, /CUSTOMER_DEV_GMAIL_SMTP_APP_PASSWORD/);
  assert.match(identityEmailService, /sendGmailSmtpMessage/);
  assert.match(
    identityEmailService,
    /Your Ysabelle Store password recovery code/
  );
});

test("recovery delivery preserves a generic public error boundary", () => {
  assert.match(
    recoveryEmailService,
    /export class CustomerRecoveryEmailDeliveryError extends Error/
  );
  assert.doesNotMatch(recoveryEmailService, /verificationCode.*console/i);
});
