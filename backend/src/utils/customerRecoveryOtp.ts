import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const CUSTOMER_RECOVERY_OTP_LIFETIME_MS = 10 * 60 * 1000;
export const CUSTOMER_RECOVERY_GRANT_LIFETIME_MS = 10 * 60 * 1000;
export const CUSTOMER_RECOVERY_MAX_CODE_ATTEMPTS = 5;

export type CustomerRecoveryOtpMaterial = {
  challengeId: string;
  verificationCode: string;
  otpHash: string;
  expiresAt: Date;
};

export type CustomerRecoveryGrantMaterial = {
  grantId: string;
  recoveryGrant: string;
  grantHash: string;
  expiresAt: Date;
};

function hashOtp(secret: string, challengeId: string, code: string): string {
  return createHmac("sha256", secret)
    .update(`customer-recovery-otp:v1:${challengeId}:${code}`)
    .digest("hex");
}

export function createCustomerRecoveryOtpMaterial(
  secret: string,
  now = new Date()
): CustomerRecoveryOtpMaterial {
  const challengeId = `otp:${randomBytes(16).toString("hex")}`;
  const verificationCode = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const otpHash = hashOtp(secret, challengeId, verificationCode);
  const expiresAt = new Date(now.getTime() + CUSTOMER_RECOVERY_OTP_LIFETIME_MS);

  return { challengeId, verificationCode, otpHash, expiresAt };
}

export function customerRecoveryOtpMatches(
  secret: string,
  challengeId: string,
  code: string,
  expectedHash: string
): boolean {
  if (!/^\d{6}$/.test(code) || !/^[a-f0-9]{64}$/i.test(expectedHash)) return false;

  const actual = Buffer.from(hashOtp(secret, challengeId, code), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function hashCustomerRecoveryGrant(grant: string): string {
  return createHash("sha256").update(grant).digest("hex");
}

export function createCustomerRecoveryGrantMaterial(
  now = new Date()
): CustomerRecoveryGrantMaterial {
  const grantId = `grant:${randomBytes(16).toString("hex")}`;
  const recoveryGrant = randomBytes(32).toString("base64url");
  const grantHash = hashCustomerRecoveryGrant(recoveryGrant);
  const expiresAt = new Date(now.getTime() + CUSTOMER_RECOVERY_GRANT_LIFETIME_MS);
  return { grantId, recoveryGrant, grantHash, expiresAt };
}

export function customerRecoveryAttemptMarkerId(challengeId: string, attempt: number): string {
  return `otp-attempt:${challengeId}:${attempt}`;
}
