import assert from "node:assert/strict";
import test from "node:test";

import {
  CUSTOMER_RECOVERY_GRANT_LIFETIME_MS,
  CUSTOMER_RECOVERY_MAX_CODE_ATTEMPTS,
  CUSTOMER_RECOVERY_OTP_LIFETIME_MS,
  createCustomerRecoveryGrantMaterial,
  createCustomerRecoveryOtpMaterial,
  customerRecoveryOtpMatches,
  hashCustomerRecoveryGrant
} from "../src/utils/customerRecoveryOtp.js";

const secret = "test-only-customer-recovery-secret";

test("customer recovery OTP material is six digits, HMAC protected, and valid for ten minutes", () => {
  const now = new Date("2026-08-27T10:00:00.000Z");
  const material = createCustomerRecoveryOtpMaterial(secret, now);

  assert.match(material.challengeId, /^otp:[a-f0-9]{32}$/);
  assert.match(material.verificationCode, /^\d{6}$/);
  assert.match(material.otpHash, /^[a-f0-9]{64}$/);
  assert.notEqual(material.otpHash, material.verificationCode);
  assert.equal(material.expiresAt.getTime(), now.getTime() + CUSTOMER_RECOVERY_OTP_LIFETIME_MS);
  assert.equal(
    customerRecoveryOtpMatches(
      secret,
      material.challengeId,
      material.verificationCode,
      material.otpHash
    ),
    true
  );

  const wrongCode = material.verificationCode === "000000" ? "000001" : "000000";
  assert.equal(
    customerRecoveryOtpMatches(secret, material.challengeId, wrongCode, material.otpHash),
    false
  );
});

test("customer recovery grant is high entropy, hash stored, and valid for ten minutes", () => {
  const now = new Date("2026-08-27T10:00:00.000Z");
  const material = createCustomerRecoveryGrantMaterial(now);

  assert.match(material.grantId, /^grant:[a-f0-9]{32}$/);
  assert.ok(material.recoveryGrant.length >= 43);
  assert.match(material.grantHash, /^[a-f0-9]{64}$/);
  assert.equal(material.grantHash, hashCustomerRecoveryGrant(material.recoveryGrant));
  assert.notEqual(material.grantHash, material.recoveryGrant);
  assert.equal(material.expiresAt.getTime(), now.getTime() + CUSTOMER_RECOVERY_GRANT_LIFETIME_MS);
});

test("customer recovery code attempt ceiling remains five", () => {
  assert.equal(CUSTOMER_RECOVERY_MAX_CODE_ATTEMPTS, 5);
});
