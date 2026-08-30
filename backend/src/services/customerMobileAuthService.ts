import { createHmac, randomBytes, randomInt } from "node:crypto";

import { env } from "../config/env.js";
import { prisma } from "../database/prismaClient.js";

export const CUSTOMER_MOBILE_AUTH_OTP_LIFETIME_MS = 10 * 60 * 1000;

export type CustomerMobileAuthRequestInput = {
  phone: string;
};

function mobileAuthOtpSecret(): string {
  const secret = env.JWT_SECRET?.trim();
  if (!secret) throw new Error("Customer mobile auth OTP secret is not configured.");
  return secret;
}

function createMobileAuthOtpMaterial(phone: string, now: Date) {
  const challengeId = `mobile-otp:${randomBytes(16).toString("hex")}`;
  const verificationCode = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const otpHash = createHmac("sha256", mobileAuthOtpSecret())
    .update(`customer-mobile-auth-otp:v1:${challengeId}:${phone}:${verificationCode}`)
    .digest("hex");
  const expiresAt = new Date(now.getTime() + CUSTOMER_MOBILE_AUTH_OTP_LIFETIME_MS);

  return { challengeId, verificationCode, otpHash, expiresAt };
}

export async function requestCustomerMobileAuth(
  input: CustomerMobileAuthRequestInput,
  now = new Date()
): Promise<void> {
  const customer = await prisma.customerAccount.findUnique({
    where: { phoneNormalized: input.phone }
  });
  if (!customer || customer.status !== "ACTIVE") return;

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
        expiresAt: otp.expiresAt
      }
    });
  });
}
