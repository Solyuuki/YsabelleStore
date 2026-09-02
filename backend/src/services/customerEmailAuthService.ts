import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

import { env } from "../config/env.js";
import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import { createCustomerSession, toSafeCustomer } from "./customerAuthService.js";
import { sendCustomerIdentityVerificationEmail } from "./customerIdentityEmailDeliveryService.js";

export const CUSTOMER_EMAIL_AUTH_OTP_LIFETIME_MS = 10 * 60 * 1000;
export const CUSTOMER_EMAIL_AUTH_RESEND_COOLDOWN_MS = 30 * 1000;
export const CUSTOMER_EMAIL_AUTH_MAX_FAILED_ATTEMPTS = 5;

const INVALID_EMAIL_AUTH_CODE = {
  code: "CUSTOMER_EMAIL_AUTH_CODE_INVALID",
  message: "The verification code is invalid or expired. Request a new code."
} as const;

function emailAuthSecret(): string {
  const secret = env.JWT_SECRET?.trim();
  if (!secret) throw new Error("Customer email auth OTP secret is not configured.");
  return secret;
}

function hashOtp(challengeId: string, email: string, verificationCode: string): string {
  return createHmac("sha256", emailAuthSecret())
    .update(`customer-email-auth-otp:v1:${challengeId}:${email}:${verificationCode}`)
    .digest("hex");
}

function invalidCode(): HttpError {
  return new HttpError(400, INVALID_EMAIL_AUTH_CODE.message, {
    code: INVALID_EMAIL_AUTH_CODE.code
  });
}

function quickSignDisplayName(email: string): string {
  const localPart = email.split("@", 1)[0]?.trim() ?? "";
  return (localPart || "Customer").slice(0, 120);
}

export async function requestCustomerEmailAuth(input: { email: string }, now = new Date()) {
  const customer = await prisma.customerAccount.findUnique({ where: { email: input.email } });
  if (customer && customer.status !== "ACTIVE") return;

  const activeChallenge = await prisma.customerEmailAuthChallenge.findFirst({
    where: {
      emailNormalized: input.email,
      consumedAt: null,
      expiresAt: { gt: now }
    },
    orderBy: { createdAt: "desc" }
  });
  if (
    activeChallenge &&
    activeChallenge.createdAt.getTime() + CUSTOMER_EMAIL_AUTH_RESEND_COOLDOWN_MS > now.getTime()
  ) {
    return;
  }

  const id = `email-auth-otp:${randomBytes(16).toString("hex")}`;
  const verificationCode = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const expiresAt = new Date(now.getTime() + CUSTOMER_EMAIL_AUTH_OTP_LIFETIME_MS);

  await prisma.$transaction(async (transaction) => {
    await transaction.customerEmailAuthChallenge.updateMany({
      data: { consumedAt: now },
      where: { emailNormalized: input.email, consumedAt: null }
    });
    await transaction.customerEmailAuthChallenge.create({
      data: {
        id,
        customerAccountId: customer?.id ?? null,
        emailNormalized: input.email,
        otpHash: hashOtp(id, input.email, verificationCode),
        expiresAt,
        createdAt: now
      }
    });
  });

  try {
    await sendCustomerIdentityVerificationEmail({
      to: input.email,
      verificationCode,
      purpose: "authentication"
    });
  } catch (error) {
    await prisma.customerEmailAuthChallenge.deleteMany({ where: { id, consumedAt: null } });
    throw error;
  }
}

export async function verifyCustomerEmailAuth(
  input: { email: string; verificationCode: string },
  now = new Date()
) {
  const challenge = await prisma.customerEmailAuthChallenge.findFirst({
    where: {
      emailNormalized: input.email,
      consumedAt: null,
      expiresAt: { gt: now },
      failedAttempts: { lt: CUSTOMER_EMAIL_AUTH_MAX_FAILED_ATTEMPTS }
    },
    orderBy: { createdAt: "desc" }
  });
  if (!challenge) throw invalidCode();

  const actual = Buffer.from(hashOtp(challenge.id, input.email, input.verificationCode), "hex");
  const expected = Buffer.from(challenge.otpHash, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    await prisma.customerEmailAuthChallenge.updateMany({
      data: { failedAttempts: { increment: 1 } },
      where: {
        id: challenge.id,
        consumedAt: null,
        expiresAt: { gt: now },
        failedAttempts: { lt: CUSTOMER_EMAIL_AUTH_MAX_FAILED_ATTEMPTS }
      }
    });
    throw invalidCode();
  }

  const verifiedCustomer = await prisma.$transaction(async (transaction) => {
    const consumed = await transaction.customerEmailAuthChallenge.updateMany({
      data: { consumedAt: now },
      where: {
        id: challenge.id,
        consumedAt: null,
        expiresAt: { gt: now },
        failedAttempts: { lt: CUSTOMER_EMAIL_AUTH_MAX_FAILED_ATTEMPTS }
      }
    });
    if (consumed.count !== 1) throw invalidCode();

    const customer = challenge.customerAccountId
      ? await transaction.customerAccount.findUnique({ where: { id: challenge.customerAccountId } })
      : await transaction.customerAccount.findUnique({ where: { email: input.email } });

    if (customer) {
      if (customer.status !== "ACTIVE" || customer.email !== input.email) throw invalidCode();
      return customer.emailVerifiedAt
        ? customer
        : transaction.customerAccount.update({
            where: { id: customer.id },
            data: { emailVerifiedAt: now }
          });
    }

    return transaction.customerAccount.create({
      data: {
        name: quickSignDisplayName(input.email),
        username: null,
        email: input.email,
        phone: null,
        phoneNormalized: null,
        emailVerifiedAt: now,
        phoneVerifiedAt: null,
        passwordHash: null,
        status: "ACTIVE"
      }
    });
  });

  const session = await createCustomerSession(verifiedCustomer.id, now);
  return { customer: toSafeCustomer(verifiedCustomer), ...session };
}
