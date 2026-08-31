import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

import { env } from "../config/env.js";
import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import {
  CustomerMobileSmsDeliveryError,
  customerMobileSmsDelivery
} from "./customerMobileSmsDeliveryService.js";

export const CUSTOMER_MOBILE_REGISTRATION_OTP_LIFETIME_MS = 10 * 60 * 1000;
export const CUSTOMER_MOBILE_REGISTRATION_RESEND_COOLDOWN_MS = 30 * 1000;

const REGISTRATION_MOBILE_GRANT_VERSION = 1;

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

type RegistrationMobileGrantPayload = {
  v: 1;
  registrationIntentHash: string;
  phone: string;
  exp: number;
};

function registrationOtpSecret(): string {
  const secret = env.JWT_SECRET?.trim();
  if (!secret) throw new Error("Customer registration mobile OTP secret is not configured.");
  return secret;
}

function registrationOtpHash(
  challengeId: string,
  registrationIntentHash: string,
  phone: string,
  verificationCode: string
): string {
  return createHmac("sha256", registrationOtpSecret())
    .update(
      `customer-mobile-registration-otp:v1:${challengeId}:${registrationIntentHash}:${phone}:${verificationCode}`
    )
    .digest("hex");
}

function signRegistrationMobileGrant(encodedPayload: string): string {
  return createHmac("sha256", registrationOtpSecret())
    .update(`customer-mobile-registration-grant:v1:${encodedPayload}`)
    .digest("base64url");
}

function createRegistrationMobileGrant(
  registrationIntentHash: string,
  phone: string,
  now: Date
): string {
  const payload: RegistrationMobileGrantPayload = {
    v: REGISTRATION_MOBILE_GRANT_VERSION,
    registrationIntentHash,
    phone,
    exp: now.getTime() + CUSTOMER_MOBILE_REGISTRATION_OTP_LIFETIME_MS
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encodedPayload}.${signRegistrationMobileGrant(encodedPayload)}`;
}

export function readCustomerMobileRegistrationGrant(
  grant: string,
  now = new Date()
): { registrationIntentHash: string; phone: string } | null {
  const [encodedPayload, suppliedSignature, ...extra] = grant.split(".");
  if (!encodedPayload || !suppliedSignature || extra.length > 0) return null;

  const expectedSignature = signRegistrationMobileGrant(encodedPayload);
  let suppliedBuffer: Buffer;
  let expectedBuffer: Buffer;

  try {
    suppliedBuffer = Buffer.from(suppliedSignature, "base64url");
    expectedBuffer = Buffer.from(expectedSignature, "base64url");
  } catch {
    return null;
  }

  if (
    suppliedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(suppliedBuffer, expectedBuffer)
  ) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object") return null;
  const candidate = payload as Partial<RegistrationMobileGrantPayload>;
  if (
    candidate.v !== REGISTRATION_MOBILE_GRANT_VERSION ||
    typeof candidate.registrationIntentHash !== "string" ||
    typeof candidate.phone !== "string" ||
    typeof candidate.exp !== "number" ||
    !Number.isSafeInteger(candidate.exp) ||
    candidate.exp <= now.getTime()
  ) {
    return null;
  }

  return {
    registrationIntentHash: candidate.registrationIntentHash,
    phone: candidate.phone
  };
}

export function hashCustomerRegistrationIntent(intentToken: string): string {
  return createHash("sha256").update(intentToken).digest("hex");
}

function createRegistrationOtpMaterial(registrationIntentHash: string, phone: string, now: Date) {
  const challengeId = `registration-mobile-otp:${randomBytes(16).toString("hex")}`;
  const verificationCode = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const otpHash = registrationOtpHash(challengeId, registrationIntentHash, phone, verificationCode);
  const expiresAt = new Date(now.getTime() + CUSTOMER_MOBILE_REGISTRATION_OTP_LIFETIME_MS);

  return { challengeId, verificationCode, otpHash, expiresAt };
}

const defaultCustomerMobileRegistrationDelivery: CustomerMobileRegistrationDelivery = async (
  input
) => {
  if (env.NODE_ENV === "test") return;

  try {
    await customerMobileSmsDelivery(input);
  } catch (error) {
    if (error instanceof CustomerMobileSmsDeliveryError) {
      throw new CustomerMobileRegistrationDeliveryError();
    }
    throw error;
  }
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
  const activeChallenge = await prisma.customerMobileRegistrationChallenge.findFirst({
    where: {
      registrationIntentHash,
      phoneNormalized: input.phone,
      consumedAt: null,
      expiresAt: { gt: now }
    },
    orderBy: { createdAt: "desc" }
  });
  if (
    activeChallenge &&
    activeChallenge.createdAt.getTime() + CUSTOMER_MOBILE_REGISTRATION_RESEND_COOLDOWN_MS >
      now.getTime()
  ) {
    return;
  }

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
    await prisma.customerMobileRegistrationChallenge.deleteMany({
      where: { id: otp.challengeId, consumedAt: null }
    });
    throw error;
  }
}

export async function verifyCustomerMobileRegistrationCode(input: {
  phone: string;
  verificationCode: string;
  registrationIntentToken: string;
  now?: Date;
}): Promise<string> {
  const now = input.now ?? new Date();
  const registrationIntentHash = hashCustomerRegistrationIntent(input.registrationIntentToken);
  const challenge = await prisma.customerMobileRegistrationChallenge.findFirst({
    where: {
      registrationIntentHash,
      phoneNormalized: input.phone,
      consumedAt: null,
      expiresAt: { gt: now }
    },
    orderBy: { createdAt: "desc" }
  });

  if (!challenge) {
    throw new HttpError(400, "Verification code is invalid or expired.", {
      code: "CUSTOMER_MOBILE_REGISTRATION_CODE_INVALID"
    });
  }

  const expectedHash = registrationOtpHash(
    challenge.id,
    registrationIntentHash,
    input.phone,
    input.verificationCode
  );
  const suppliedHash = Buffer.from(expectedHash, "hex");
  const storedHash = Buffer.from(challenge.otpHash, "hex");
  if (suppliedHash.length !== storedHash.length || !timingSafeEqual(suppliedHash, storedHash)) {
    throw new HttpError(400, "Verification code is invalid or expired.", {
      code: "CUSTOMER_MOBILE_REGISTRATION_CODE_INVALID"
    });
  }

  const consumed = await prisma.customerMobileRegistrationChallenge.updateMany({
    data: { consumedAt: now },
    where: {
      id: challenge.id,
      consumedAt: null,
      expiresAt: { gt: now }
    }
  });

  if (consumed.count !== 1) {
    throw new HttpError(400, "Verification code is invalid or expired.", {
      code: "CUSTOMER_MOBILE_REGISTRATION_CODE_INVALID"
    });
  }

  return createRegistrationMobileGrant(registrationIntentHash, input.phone, now);
}
