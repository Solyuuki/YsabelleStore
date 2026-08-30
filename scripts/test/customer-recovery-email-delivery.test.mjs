import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
const recoveryEmailService = fs.readFileSync(
  path.join(REPO_ROOT, "backend", "src", "services", "customerRecoveryEmailService.ts"),
  "utf8"
);

test("development recovery email retries a rejected custom sender with the Resend test sender", () => {
  assert.match(
    recoveryEmailService,
    /const DEVELOPMENT_RESEND_FROM_EMAIL = "onboarding@resend\.dev"/
  );
  assert.match(recoveryEmailService, /sendRecoveryEmailRequest/);
  assert.match(
    recoveryEmailService,
    /response\.status !== 403 \|\| env\.NODE_ENV === "production"/
  );
  assert.match(recoveryEmailService, /from !== DEVELOPMENT_RESEND_FROM_EMAIL/);
  assert.match(recoveryEmailService, /domain.*not verified|verify a domain|testing emails/i);
  assert.match(recoveryEmailService, /"user-agent": "YsabelleStore\/customer-recovery"/);
});

test("recovery email keeps production strict instead of always replacing the configured sender", () => {
  assert.doesNotMatch(
    recoveryEmailService,
    /const from = env\.NODE_ENV === "production"\s*\?[^:]+:\s*DEVELOPMENT_RESEND_FROM_EMAIL/s
  );
});

test("recovery email presents Ysabelle Store as the sender name for configured and fallback addresses", () => {
  assert.match(recoveryEmailService, /const CUSTOMER_RECOVERY_FROM_NAME = "Ysabelle Store"/);
  assert.match(recoveryEmailService, /function formatRecoveryFromAddress\(email: string\)/);
  assert.match(recoveryEmailService, /return `\$\{CUSTOMER_RECOVERY_FROM_NAME\} <\$\{email\}>`/);
  assert.match(recoveryEmailService, /from: formatRecoveryFromAddress\(input\.from\)/);
});
