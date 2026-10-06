import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const CUSTOMER_PASSWORD_SETUP_OTP_LIFETIME_MS = 10 * 60 * 1000;
export const CUSTOMER_PASSWORD_SETUP_GRANT_LIFETIME_MS = 10 * 60 * 1000;
export const CUSTOMER_PASSWORD_SETUP_MAX_CODE_ATTEMPTS = 5;

export type CustomerPasswordSetupOtpMaterial = {
  challengeId: string;
  verificationCode: string;
  otpHash: string;
  expiresAt: Date;
};

export type CustomerPasswordSetupGrantMaterial = {
  grantId: string;
  setupGrant: string;
  grantHash: string;
  expiresAt: Date;
};

function hashOtp(secret: string, challengeId: string, code: string): string {
  return createHmac("sha256", secret)
    .update(`customer-password-setup-otp:v1:${challengeId}:${code}`)
    .digest("hex");
}

export function createCustomerPasswordSetupOtpMaterial(
  secret: string,
  now = new Date()
): CustomerPasswordSetupOtpMaterial {
  const challengeId = `setup-otp:${randomBytes(16).toString("hex")}`;
  const verificationCode = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const otpHash = hashOtp(secret, challengeId, verificationCode);
  const expiresAt = new Date(now.getTime() + CUSTOMER_PASSWORD_SETUP_OTP_LIFETIME_MS);

  return { challengeId, verificationCode, otpHash, expiresAt };
}

export function customerPasswordSetupOtpMatches(
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

export function createCustomerPasswordSetupGrantMaterial(
  now = new Date()
): CustomerPasswordSetupGrantMaterial {
  const grantId = `setup-grant:${randomBytes(16).toString("hex")}`;
  const setupGrant = randomBytes(32).toString("base64url");
  const grantHash = hashCustomerPasswordSetupGrant(setupGrant);
  const expiresAt = new Date(now.getTime() + CUSTOMER_PASSWORD_SETUP_GRANT_LIFETIME_MS);

  return { grantId, setupGrant, grantHash, expiresAt };
}

export function hashCustomerPasswordSetupGrant(grant: string): string {
  return createHash("sha256").update(grant).digest("hex");
}

export function customerPasswordSetupAttemptMarkerId(challengeId: string, attempt: number): string {
  return `setup-attempt:${challengeId}:${attempt}`;
}

export function hashCustomerPasswordSetupAttemptMarker(markerId: string): string {
  return createHash("sha256").update(`customer-password-setup-attempt:${markerId}`).digest("hex");
}
