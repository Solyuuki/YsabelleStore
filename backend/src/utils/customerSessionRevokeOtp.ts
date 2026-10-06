import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const CUSTOMER_SESSION_REVOKE_OTP_LIFETIME_MS = 10 * 60 * 1000;
export const CUSTOMER_SESSION_REVOKE_GRANT_LIFETIME_MS = 10 * 60 * 1000;
export const CUSTOMER_SESSION_REVOKE_MAX_CODE_ATTEMPTS = 5;

export type CustomerSessionRevokeOtpMaterial = {
  challengeId: string;
  verificationCode: string;
  otpHash: string;
  expiresAt: Date;
};

export type CustomerSessionRevokeGrantMaterial = {
  grantId: string;
  sessionRevokeGrant: string;
  grantHash: string;
  expiresAt: Date;
};

function hashOtp(secret: string, challengeId: string, code: string): string {
  return createHmac("sha256", secret)
    .update(`customer-session-revoke-otp:v1:${challengeId}:${code}`)
    .digest("hex");
}

export function createCustomerSessionRevokeOtpMaterial(
  secret: string,
  now = new Date()
): CustomerSessionRevokeOtpMaterial {
  const challengeId = `session-revoke-otp:${randomBytes(16).toString("hex")}`;
  const verificationCode = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const otpHash = hashOtp(secret, challengeId, verificationCode);
  const expiresAt = new Date(now.getTime() + CUSTOMER_SESSION_REVOKE_OTP_LIFETIME_MS);

  return { challengeId, verificationCode, otpHash, expiresAt };
}

export function customerSessionRevokeOtpMatches(
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

export function createCustomerSessionRevokeGrantMaterial(
  now = new Date()
): CustomerSessionRevokeGrantMaterial {
  const grantId = `session-revoke-grant:${randomBytes(16).toString("hex")}`;
  const sessionRevokeGrant = randomBytes(32).toString("base64url");
  const grantHash = hashCustomerSessionRevokeGrant(sessionRevokeGrant);
  const expiresAt = new Date(now.getTime() + CUSTOMER_SESSION_REVOKE_GRANT_LIFETIME_MS);

  return { grantId, sessionRevokeGrant, grantHash, expiresAt };
}

export function hashCustomerSessionRevokeGrant(grant: string): string {
  return createHash("sha256").update(grant).digest("hex");
}

export function customerSessionRevokeAttemptMarkerId(challengeId: string, attempt: number): string {
  return `session-revoke-attempt:${challengeId}:${attempt}`;
}

export function hashCustomerSessionRevokeAttemptMarker(markerId: string): string {
  return createHash("sha256").update(`customer-session-revoke-attempt:${markerId}`).digest("hex");
}
