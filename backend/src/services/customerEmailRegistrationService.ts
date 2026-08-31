import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

import { env } from "../config/env.js";
import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import { hashCustomerRegistrationIntent } from "./customerMobileRegistrationService.js";
import { sendCustomerIdentityVerificationEmail } from "./customerIdentityEmailDeliveryService.js";

export const CUSTOMER_EMAIL_REGISTRATION_OTP_LIFETIME_MS = 10 * 60 * 1000;
export const CUSTOMER_EMAIL_REGISTRATION_RESEND_COOLDOWN_MS = 30 * 1000;
export const CUSTOMER_EMAIL_REGISTRATION_MAX_FAILED_ATTEMPTS = 5;

const REGISTRATION_EMAIL_GRANT_VERSION = 1;
const INVALID_REGISTRATION_EMAIL_CODE = {
  code: "CUSTOMER_EMAIL_REGISTRATION_CODE_INVALID",
  message: "Verification code is invalid or expired."
} as const;

type RegistrationEmailGrantPayload = {
  v: 1;
  registrationIntentHash: string;
  email: string;
  exp: number;
};

function registrationEmailSecret(): string {
  const secret = env.JWT_SECRET?.trim();
  if (!secret) throw new Error("Customer registration email OTP secret is not configured.");
  return secret;
}

function registrationOtpHash(
  challengeId: string,
  registrationIntentHash: string,
  email: string,
  verificationCode: string
): string {
  return createHmac("sha256", registrationEmailSecret())
    .update(
      `customer-email-registration-otp:v1:${challengeId}:${registrationIntentHash}:${email}:${verificationCode}`
    )
    .digest("hex");
}

function signGrant(encodedPayload: string): string {
  return createHmac("sha256", registrationEmailSecret())
    .update(`customer-email-registration-grant:v1:${encodedPayload}`)
    .digest("base64url");
}

function createGrant(registrationIntentHash: string, email: string, now: Date): string {
  const payload: RegistrationEmailGrantPayload = {
    v: REGISTRATION_EMAIL_GRANT_VERSION,
    registrationIntentHash,
    email,
    exp: now.getTime() + CUSTOMER_EMAIL_REGISTRATION_OTP_LIFETIME_MS
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${signGrant(encodedPayload)}`;
}

export function readCustomerEmailRegistrationGrant(
  grant: string,
  now = new Date()
): { registrationIntentHash: string; email: string } | null {
  const [encodedPayload, suppliedSignature, ...extra] = grant.split(".");
  if (!encodedPayload || !suppliedSignature || extra.length > 0) return null;

  const expectedSignature = signGrant(encodedPayload);
  let supplied: Buffer;
  let expected: Buffer;
  try {
    supplied = Buffer.from(suppliedSignature, "base64url");
    expected = Buffer.from(expectedSignature, "base64url");
  } catch {
    return null;
  }

  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as Partial<RegistrationEmailGrantPayload>;
  if (
    candidate.v !== REGISTRATION_EMAIL_GRANT_VERSION ||
    typeof candidate.registrationIntentHash !== "string" ||
    typeof candidate.email !== "string" ||
    typeof candidate.exp !== "number" ||
    !Number.isSafeInteger(candidate.exp) ||
    candidate.exp <= now.getTime()
  ) {
    return null;
  }

  return {
    registrationIntentHash: candidate.registrationIntentHash,
    email: candidate.email
  };
}

function createOtpMaterial(registrationIntentHash: string, email: string, now: Date) {
  const challengeId = `registration-email-otp:${randomBytes(16).toString("hex")}`;
  const verificationCode = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const otpHash = registrationOtpHash(
    challengeId,
    registrationIntentHash,
    email,
    verificationCode
  );
  const expiresAt = new Date(now.getTime() + CUSTOMER_EMAIL_REGISTRATION_OTP_LIFETIME_MS);
  return { challengeId, verificationCode, otpHash, expiresAt };
}

function invalidCode(): HttpError {
  return new HttpError(400, INVALID_REGISTRATION_EMAIL_CODE.message, {
    code: INVALID_REGISTRATION_EMAIL_CODE.code
  });
}

export async function requestCustomerEmailRegistrationVerification(
  input: { email: string; registrationIntentToken: string },
  now = new Date()
): Promise<void> {
  const existingCustomer = await prisma.customerAccount.findUnique({ where: { email: input.email } });
  if (existingCustomer) return;

  const registrationIntentHash = hashCustomerRegistrationIntent(input.registrationIntentToken);
  const activeChallenge = await prisma.customerEmailRegistrationChallenge.findFirst({
    where: {
      registrationIntentHash,
      emailNormalized: input.email,
      consumedAt: null,
      expiresAt: { gt: now }
    },
    orderBy: { createdAt: "desc" }
  });
  if (
    activeChallenge &&
    activeChallenge.createdAt.getTime() + CUSTOMER_EMAIL_REGISTRATION_RESEND_COOLDOWN_MS > now.getTime()
  ) {
    return;
  }

  const otp = createOtpMaterial(registrationIntentHash, input.email, now);

  await prisma.$transaction(async (transaction) => {
    await transaction.customerEmailRegistrationChallenge.updateMany({
      data: { consumedAt: now },
      where: {
        registrationIntentHash,
        emailNormalized: input.email,
        consumedAt: null
      }
    });

    await transaction.customerEmailRegistrationChallenge.create({
      data: {
        id: otp.challengeId,
        registrationIntentHash,
        emailNormalized: input.email,
        otpHash: otp.otpHash,
        expiresAt: otp.expiresAt,
        createdAt: now
      }
    });
  });

  try {
    await sendCustomerIdentityVerificationEmail({
      to: input.email,
      verificationCode: otp.verificationCode,
      purpose: "registration"
    });
  } catch (error) {
    await prisma.customerEmailRegistrationChallenge.deleteMany({
      where: { id: otp.challengeId, consumedAt: null }
    });
    throw error;
  }
}

export async function verifyCustomerEmailRegistrationCode(input: {
  email: string;
  verificationCode: string;
  registrationIntentToken: string;
  now?: Date;
}): Promise<string> {
  const now = input.now ?? new Date();
  const registrationIntentHash = hashCustomerRegistrationIntent(input.registrationIntentToken);
  const challenge = await prisma.customerEmailRegistrationChallenge.findFirst({
    where: {
      registrationIntentHash,
      emailNormalized: input.email,
      consumedAt: null,
      expiresAt: { gt: now },
      failedAttempts: { lt: CUSTOMER_EMAIL_REGISTRATION_MAX_FAILED_ATTEMPTS }
    },
    orderBy: { createdAt: "desc" }
  });

  if (!challenge) throw invalidCode();

  const actual = Buffer.from(
    registrationOtpHash(
      challenge.id,
      registrationIntentHash,
      input.email,
      input.verificationCode
    ),
    "hex"
  );
  const expected = Buffer.from(challenge.otpHash, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    await prisma.customerEmailRegistrationChallenge.updateMany({
      data: { failedAttempts: { increment: 1 } },
      where: {
        id: challenge.id,
        consumedAt: null,
        expiresAt: { gt: now },
        failedAttempts: { lt: CUSTOMER_EMAIL_REGISTRATION_MAX_FAILED_ATTEMPTS }
      }
    });
    throw invalidCode();
  }

  const consumed = await prisma.customerEmailRegistrationChallenge.updateMany({
    data: { consumedAt: now },
    where: {
      id: challenge.id,
      consumedAt: null,
      expiresAt: { gt: now },
      failedAttempts: { lt: CUSTOMER_EMAIL_REGISTRATION_MAX_FAILED_ATTEMPTS }
    }
  });
  if (consumed.count !== 1) throw invalidCode();

  return createGrant(registrationIntentHash, input.email, now);
}
