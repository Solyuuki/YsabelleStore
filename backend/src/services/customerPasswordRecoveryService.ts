import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";

import { env } from "../config/env.js";
import { prisma } from "../database/prismaClient.js";
import { classifyCustomerLoginIdentifier } from "../utils/customerIdentity.js";
import {
  CUSTOMER_RECOVERY_MAX_CODE_ATTEMPTS,
  createCustomerRecoveryGrantMaterial,
  createCustomerRecoveryOtpMaterial,
  customerRecoveryAttemptMarkerId,
  customerRecoveryOtpMatches,
  hashCustomerRecoveryGrant
} from "../utils/customerRecoveryOtp.js";
import { HttpError } from "../utils/httpError.js";
import { hashPassword } from "./passwordHashService.js";

const INVALID_RECOVERY_CODE = {
  code: "CUSTOMER_PASSWORD_RECOVERY_CODE_INVALID",
  message: "The verification code is invalid or expired. Request a new code."
} as const;
const INVALID_RECOVERY_GRANT = {
  code: "CUSTOMER_PASSWORD_RECOVERY_INVALID",
  message: "This recovery session is invalid or expired. Request a new code."
} as const;

export type CustomerRecoveryEmailDelivery = {
  sendPasswordRecoveryEmail(input: {
    to: string;
    verificationCode: string;
    expiresAt: Date;
  }): Promise<void>;
};

export type CustomerPasswordRecoveryRequestInput = {
  identifier: string;
};

export type CustomerPasswordRecoveryVerifyInput = {
  identifier: string;
  verificationCode: string;
};

export type CustomerPasswordResetInput = {
  recoveryGrant: string;
  newPassword: string;
};

function recoveryOtpSecret(): string {
  const secret = env.JWT_SECRET?.trim();
  if (!secret) throw new Error("Customer recovery OTP secret is not configured.");
  return secret;
}

function invalidRecoveryCode(): HttpError {
  return new HttpError(400, INVALID_RECOVERY_CODE.message, {
    code: INVALID_RECOVERY_CODE.code
  });
}

function invalidRecoveryGrant(): HttpError {
  return new HttpError(400, INVALID_RECOVERY_GRANT.message, {
    code: INVALID_RECOVERY_GRANT.code
  });
}

async function findActiveCustomerByIdentifier(identifier: string) {
  const classification = classifyCustomerLoginIdentifier(identifier);
  if (!classification) return null;

  const customer =
    classification.kind === "email"
      ? await prisma.customerAccount.findUnique({ where: { email: classification.normalized } })
      : classification.kind === "phone"
        ? await prisma.customerAccount.findUnique({
            where: { phoneNormalized: classification.normalized }
          })
        : await prisma.customerAccount.findUnique({
            where: { username: classification.normalized }
          });

  return customer?.status === "ACTIVE" ? customer : null;
}

function markerHash(markerId: string): string {
  return createHash("sha256").update(`customer-recovery-attempt:${markerId}`).digest("hex");
}

async function recordFailedVerificationAttempt(
  challenge: { id: string; customerAccountId: string; expiresAt: Date },
  now: Date
): Promise<never> {
  for (let attempt = 1; attempt <= CUSTOMER_RECOVERY_MAX_CODE_ATTEMPTS; attempt += 1) {
    const markerId = customerRecoveryAttemptMarkerId(challenge.id, attempt);

    try {
      await prisma.customerPasswordResetToken.create({
        data: {
          id: markerId,
          customerAccountId: challenge.customerAccountId,
          tokenHash: markerHash(markerId),
          expiresAt: challenge.expiresAt,
          usedAt: now
        }
      });

      if (attempt === CUSTOMER_RECOVERY_MAX_CODE_ATTEMPTS) {
        await prisma.customerPasswordResetToken.updateMany({
          data: { usedAt: now },
          where: { id: challenge.id, usedAt: null }
        });
      }

      throw invalidRecoveryCode();
    } catch (error) {
      if (error instanceof HttpError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        continue;
      }
      throw error;
    }
  }

  await prisma.customerPasswordResetToken.updateMany({
    data: { usedAt: now },
    where: { id: challenge.id, usedAt: null }
  });
  throw invalidRecoveryCode();
}

export async function requestCustomerPasswordRecovery(
  input: CustomerPasswordRecoveryRequestInput,
  delivery: CustomerRecoveryEmailDelivery,
  now = new Date()
): Promise<void> {
  const customer = await findActiveCustomerByIdentifier(input.identifier);
  if (!customer) return;

  const otp = createCustomerRecoveryOtpMaterial(recoveryOtpSecret(), now);

  const challenge = await prisma.$transaction(async (transaction) => {
    await transaction.customerPasswordResetToken.updateMany({
      data: { usedAt: now },
      where: {
        customerAccountId: customer.id,
        usedAt: null
      }
    });

    return transaction.customerPasswordResetToken.create({
      data: {
        id: otp.challengeId,
        customerAccountId: customer.id,
        tokenHash: otp.otpHash,
        expiresAt: otp.expiresAt
      }
    });
  });

  try {
    await delivery.sendPasswordRecoveryEmail({
      to: customer.email,
      verificationCode: otp.verificationCode,
      expiresAt: otp.expiresAt
    });
  } catch (error) {
    await prisma.customerPasswordResetToken.deleteMany({
      where: {
        id: challenge.id,
        usedAt: null
      }
    });
    throw error;
  }
}

export async function verifyCustomerPasswordRecoveryCode(
  input: CustomerPasswordRecoveryVerifyInput,
  now = new Date()
): Promise<{ recoveryGrant: string; expiresAt: Date }> {
  if (!/^\d{6}$/.test(input.verificationCode)) throw invalidRecoveryCode();

  const customer = await findActiveCustomerByIdentifier(input.identifier);
  if (!customer) throw invalidRecoveryCode();

  const challenge = await prisma.customerPasswordResetToken.findFirst({
    where: {
      customerAccountId: customer.id,
      id: { startsWith: "otp:" },
      usedAt: null,
      expiresAt: { gt: now }
    },
    orderBy: { createdAt: "desc" }
  });
  if (!challenge) throw invalidRecoveryCode();

  const matches = customerRecoveryOtpMatches(
    recoveryOtpSecret(),
    challenge.id,
    input.verificationCode,
    challenge.tokenHash
  );
  if (!matches) {
    return recordFailedVerificationAttempt(challenge, now);
  }

  const grant = createCustomerRecoveryGrantMaterial(now);

  await prisma.$transaction(async (transaction) => {
    const consumed = await transaction.customerPasswordResetToken.updateMany({
      data: { usedAt: now },
      where: {
        id: challenge.id,
        usedAt: null,
        expiresAt: { gt: now }
      }
    });
    if (consumed.count !== 1) throw invalidRecoveryCode();

    await transaction.customerPasswordResetToken.create({
      data: {
        id: grant.grantId,
        customerAccountId: challenge.customerAccountId,
        tokenHash: grant.grantHash,
        expiresAt: grant.expiresAt
      }
    });
  });

  return { recoveryGrant: grant.recoveryGrant, expiresAt: grant.expiresAt };
}

export async function resetCustomerPassword(
  input: CustomerPasswordResetInput,
  now = new Date()
): Promise<void> {
  if (
    !input.recoveryGrant ||
    input.recoveryGrant.length < 32 ||
    input.newPassword.length < 8 ||
    input.newPassword.length > 128
  ) {
    throw invalidRecoveryGrant();
  }

  const grantHash = hashCustomerRecoveryGrant(input.recoveryGrant);
  const grant = await prisma.customerPasswordResetToken.findUnique({
    include: { customerAccount: true },
    where: { tokenHash: grantHash }
  });

  if (
    !grant ||
    !grant.id.startsWith("grant:") ||
    grant.usedAt !== null ||
    grant.expiresAt.getTime() <= now.getTime() ||
    grant.customerAccount.status !== "ACTIVE"
  ) {
    throw invalidRecoveryGrant();
  }

  const nextPasswordHash = await hashPassword(input.newPassword);

  await prisma.$transaction(async (transaction) => {
    const consumed = await transaction.customerPasswordResetToken.updateMany({
      data: { usedAt: now },
      where: {
        id: grant.id,
        usedAt: null,
        expiresAt: { gt: now }
      }
    });
    if (consumed.count !== 1) throw invalidRecoveryGrant();

    const customerUpdate = await transaction.customerAccount.updateMany({
      data: { passwordHash: nextPasswordHash },
      where: {
        id: grant.customerAccountId,
        status: "ACTIVE"
      }
    });
    if (customerUpdate.count !== 1) throw invalidRecoveryGrant();

    await transaction.customerPasswordResetToken.updateMany({
      data: { usedAt: now },
      where: {
        customerAccountId: grant.customerAccountId,
        usedAt: null
      }
    });

    await transaction.customerSession.updateMany({
      data: { revokedAt: now },
      where: {
        customerAccountId: grant.customerAccountId,
        revokedAt: null
      }
    });
  });
}
