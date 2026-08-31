import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

import { env } from "../config/env.js";
import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import { createCustomerSession, toSafeCustomer } from "./customerAuthService.js";
import {
  CustomerMobileSmsDeliveryError,
  customerMobileSmsDelivery
} from "./customerMobileSmsDeliveryService.js";

export const CUSTOMER_MOBILE_AUTH_OTP_LIFETIME_MS = 10 * 60 * 1000;
export const CUSTOMER_MOBILE_AUTH_RESEND_COOLDOWN_MS = 30 * 1000;
export const CUSTOMER_MOBILE_AUTH_MAX_FAILED_ATTEMPTS = 5;

const INVALID_MOBILE_AUTH_CODE = {
  code: "CUSTOMER_MOBILE_AUTH_CODE_INVALID",
  message: "The verification code is invalid or expired. Request a new code."
} as const;

export class CustomerMobileAuthDeliveryError extends Error {
  public constructor() {
    super("Customer mobile OTP delivery is unavailable.");
    this.name = "CustomerMobileAuthDeliveryError";
  }
}

export type CustomerMobileAuthDelivery = (input: {
  phone: string;
  verificationCode: string;
}) => Promise<void>;

export type CustomerMobileAuthRequestInput = {
  phone: string;
};

export type CustomerMobileAuthVerifyInput = {
  phone: string;
  verificationCode: string;
};

function mobileAuthOtpSecret(): string {
  const secret = env.JWT_SECRET?.trim();
  if (!secret) throw new Error("Customer mobile auth OTP secret is not configured.");
  return secret;
}

function hashMobileAuthOtp(challengeId: string, phone: string, verificationCode: string) {
  return createHmac("sha256", mobileAuthOtpSecret())
    .update(`customer-mobile-auth-otp:v1:${challengeId}:${phone}:${verificationCode}`)
    .digest("hex");
}

function createMobileAuthOtpMaterial(phone: string, now: Date) {
  const challengeId = `mobile-otp:${randomBytes(16).toString("hex")}`;
  const verificationCode = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const otpHash = hashMobileAuthOtp(challengeId, phone, verificationCode);
  const expiresAt = new Date(now.getTime() + CUSTOMER_MOBILE_AUTH_OTP_LIFETIME_MS);

  return { challengeId, verificationCode, otpHash, expiresAt };
}

function mobileAuthOtpMatches(
  challengeId: string,
  phone: string,
  verificationCode: string,
  expectedHash: string
) {
  const actual = Buffer.from(hashMobileAuthOtp(challengeId, phone, verificationCode), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function invalidMobileAuthCode(): HttpError {
  return new HttpError(400, INVALID_MOBILE_AUTH_CODE.message, {
    code: INVALID_MOBILE_AUTH_CODE.code
  });
}

const defaultCustomerMobileAuthDelivery: CustomerMobileAuthDelivery = async (input) => {
  if (env.NODE_ENV === "test") return;

  try {
    await customerMobileSmsDelivery(input);
  } catch (error) {
    if (error instanceof CustomerMobileSmsDeliveryError) {
      throw new CustomerMobileAuthDeliveryError();
    }
    throw error;
  }
};

export async function requestCustomerMobileAuth(
  input: CustomerMobileAuthRequestInput,
  delivery: CustomerMobileAuthDelivery = defaultCustomerMobileAuthDelivery,
  now = new Date()
): Promise<void> {
  const customer = await prisma.customerAccount.findUnique({
    where: { phoneNormalized: input.phone }
  });
  if (!customer || customer.status !== "ACTIVE" || !customer.phoneVerifiedAt) return;

  const activeChallenge = await prisma.customerMobileAuthChallenge.findFirst({
    where: {
      phoneNormalized: input.phone,
      consumedAt: null,
      expiresAt: { gt: now }
    },
    orderBy: { createdAt: "desc" }
  });
  if (
    activeChallenge &&
    activeChallenge.createdAt.getTime() + CUSTOMER_MOBILE_AUTH_RESEND_COOLDOWN_MS > now.getTime()
  ) {
    return;
  }

  const otp = createMobileAuthOtpMaterial(input.phone, now);

  await prisma.$transaction(async (transaction) => {
    await transaction.customerMobileAuthChallenge.updateMany({
      data: { consumedAt: now },
      where: {
        phoneNormalized: input.phone,
        consumedAt: null
      }
    });

    await transaction.customerMobileAuthChallenge.create({
      data: {
        id: otp.challengeId,
        customerAccountId: customer.id,
        phoneNormalized: input.phone,
        otpHash: otp.otpHash,
        expiresAt: otp.expiresAt,
        createdAt: now
      }
    });
  });

  try {
    await delivery({
      phone: input.phone,
      verificationCode: otp.verificationCode
    });
  } catch (error) {
    await prisma.customerMobileAuthChallenge.deleteMany({
      where: { id: otp.challengeId, consumedAt: null }
    });
    throw error;
  }
}

export async function verifyCustomerMobileAuth(
  input: CustomerMobileAuthVerifyInput,
  now = new Date()
) {
  const challenge = await prisma.customerMobileAuthChallenge.findFirst({
    where: {
      phoneNormalized: input.phone,
      consumedAt: null,
      expiresAt: { gt: now },
      failedAttempts: { lt: CUSTOMER_MOBILE_AUTH_MAX_FAILED_ATTEMPTS }
    },
    orderBy: { createdAt: "desc" }
  });

  if (!challenge?.customerAccountId) throw invalidMobileAuthCode();
  if (!mobileAuthOtpMatches(challenge.id, input.phone, input.verificationCode, challenge.otpHash)) {
    await prisma.customerMobileAuthChallenge.updateMany({
      data: { failedAttempts: { increment: 1 } },
      where: {
        id: challenge.id,
        consumedAt: null,
        expiresAt: { gt: now },
        failedAttempts: { lt: CUSTOMER_MOBILE_AUTH_MAX_FAILED_ATTEMPTS }
      }
    });
    throw invalidMobileAuthCode();
  }

  const customer = await prisma.customerAccount.findUnique({
    where: { id: challenge.customerAccountId }
  });
  if (
    !customer ||
    customer.status !== "ACTIVE" ||
    !customer.phoneVerifiedAt ||
    customer.phoneNormalized !== input.phone
  ) {
    throw invalidMobileAuthCode();
  }

  const consumed = await prisma.customerMobileAuthChallenge.updateMany({
    data: { consumedAt: now },
    where: {
      id: challenge.id,
      consumedAt: null,
      expiresAt: { gt: now },
      failedAttempts: { lt: CUSTOMER_MOBILE_AUTH_MAX_FAILED_ATTEMPTS }
    }
  });
  if (consumed.count !== 1) throw invalidMobileAuthCode();

  const session = await createCustomerSession(customer.id, now);
  return {
    customer: toSafeCustomer(customer),
    ...session
  };
}
