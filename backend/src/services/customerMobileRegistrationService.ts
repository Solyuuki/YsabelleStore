import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";

import { env } from "../config/env.js";
import { prisma } from "../database/prismaClient.js";

export const CUSTOMER_MOBILE_REGISTRATION_OTP_LIFETIME_MS = 10 * 60 * 1000;

export class CustomerMobileRegistrationDeliveryError extends Error {
  public constructor() {
    super("Customer registration mobile OTP delivery is unavailable.");
    this.name = "CustomerMobileRegistrationDeliveryError";
  }
}

export type CustomerMobileRegistrationDelivery = (input: {
  phone: string;
  verificationCode: string;
}) => Promise<void>;

function registrationOtpSecret(): string {
  const secret = env.JWT_SECRET?.trim();
  if (!secret) throw new Error("Customer registration mobile OTP secret is not configured.");
  return secret;
}

export function hashCustomerRegistrationIntent(intentToken: string): string {
  return createHash("sha256").update(intentToken).digest("hex");
}

function createRegistrationOtpMaterial(
  registrationIntentHash: string,
  phone: string,
  now: Date
) {
  const challengeId = `registration-mobile-otp:${randomBytes(16).toString("hex")}`;
  const verificationCode = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const otpHash = createHmac("sha256", registrationOtpSecret())
    .update(
      `customer-mobile-registration-otp:v1:${challengeId}:${registrationIntentHash}:${phone}:${verificationCode}`
    )
    .digest("hex");
  const expiresAt = new Date(now.getTime() + CUSTOMER_MOBILE_REGISTRATION_OTP_LIFETIME_MS);

  return { challengeId, verificationCode, otpHash, expiresAt };
}

const defaultCustomerMobileRegistrationDelivery: CustomerMobileRegistrationDelivery = async ({
  phone,
  verificationCode
}) => {
  if (env.NODE_ENV === "development") {
    console.info(
      JSON.stringify({
        event: "customer_mobile_registration_dev_otp",
        phoneLast4: phone.slice(-4),
        verificationCode
      })
    );
    return;
  }

  if (env.NODE_ENV === "test") return;
  throw new CustomerMobileRegistrationDeliveryError();
};

export async function requestCustomerMobileRegistrationVerification(
  input: { phone: string; registrationIntentToken: string },
  delivery: CustomerMobileRegistrationDelivery = defaultCustomerMobileRegistrationDelivery,
  now = new Date()
): Promise<void> {
  const existingCustomer = await prisma.customerAccount.findUnique({
    where: { phoneNormalized: input.phone }
  });
  if (existingCustomer) return;

  const registrationIntentHash = hashCustomerRegistrationIntent(input.registrationIntentToken);
  const otp = createRegistrationOtpMaterial(registrationIntentHash, input.phone, now);

  await prisma.$transaction(async (transaction) => {
    await transaction.customerMobileRegistrationChallenge.updateMany({
      data: { consumedAt: now },
      where: {
        registrationIntentHash,
        phoneNormalized: input.phone,
        consumedAt: null
      }
    });

    await transaction.customerMobileRegistrationChallenge.create({
      data: {
        id: otp.challengeId,
        registrationIntentHash,
        phoneNormalized: input.phone,
        otpHash: otp.otpHash,
        expiresAt: otp.expiresAt
      }
    });
  });

  try {
    await delivery({
      phone: input.phone,
      verificationCode: otp.verificationCode
    });
  } catch (error) {
    await prisma.customerMobileRegistrationChallenge.deleteMany({
      where: { id: otp.challengeId, consumedAt: null }
    });
    throw error;
  }
}
