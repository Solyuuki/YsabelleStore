import { createHash, randomBytes } from "node:crypto";

import { env } from "../config/env.js";
import { prisma } from "../database/prismaClient.js";
import { classifyCustomerLoginIdentifier } from "../utils/customerIdentity.js";
import { HttpError } from "../utils/httpError.js";
import { hashPassword } from "./passwordHashService.js";

const CUSTOMER_PASSWORD_RESET_LIFETIME_MS = 15 * 60 * 1000;
const INVALID_RECOVERY = {
  code: "CUSTOMER_PASSWORD_RECOVERY_INVALID",
  message: "This recovery link is invalid or expired. Request a new one."
} as const;

export type CustomerRecoveryEmailDelivery = {
  sendPasswordRecoveryEmail(input: {
    to: string;
    recoveryUrl: string;
    expiresAt: Date;
  }): Promise<void>;
};

export type CustomerPasswordRecoveryRequestInput = {
  identifier: string;
};

export type CustomerPasswordResetInput = {
  token: string;
  newPassword: string;
};

export function hashCustomerPasswordResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function invalidRecovery(): HttpError {
  return new HttpError(400, INVALID_RECOVERY.message, {
    code: INVALID_RECOVERY.code
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

export async function requestCustomerPasswordRecovery(
  input: CustomerPasswordRecoveryRequestInput,
  delivery: CustomerRecoveryEmailDelivery,
  now = new Date()
): Promise<void> {
  const customer = await findActiveCustomerByIdentifier(input.identifier);
  if (!customer) return;

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashCustomerPasswordResetToken(rawToken);
  const expiresAt = new Date(now.getTime() + CUSTOMER_PASSWORD_RESET_LIFETIME_MS);

  const resetToken = await prisma.$transaction(async (transaction) => {
    await transaction.customerPasswordResetToken.updateMany({
      data: { usedAt: now },
      where: {
        customerAccountId: customer.id,
        usedAt: null
      }
    });

    return transaction.customerPasswordResetToken.create({
      data: {
        customerAccountId: customer.id,
        tokenHash,
        expiresAt
      }
    });
  });

  const frontendOrigin = env.FRONTEND_URL.replace(/\/$/, "");
  const recoveryUrl = `${frontendOrigin}/account-recovery?token=${encodeURIComponent(rawToken)}`;

  try {
    await delivery.sendPasswordRecoveryEmail({
      to: customer.email,
      recoveryUrl,
      expiresAt
    });
  } catch (error) {
    await prisma.customerPasswordResetToken.deleteMany({
      where: {
        id: resetToken.id,
        usedAt: null
      }
    });
    throw error;
  }
}

export async function resetCustomerPassword(
  input: CustomerPasswordResetInput,
  now = new Date()
): Promise<void> {
  if (!input.token || input.token.length < 32 || input.newPassword.length < 8 || input.newPassword.length > 128) {
    throw invalidRecovery();
  }

  const tokenHash = hashCustomerPasswordResetToken(input.token);
  const resetToken = await prisma.customerPasswordResetToken.findUnique({
    include: { customerAccount: true },
    where: { tokenHash }
  });

  if (
    !resetToken ||
    resetToken.usedAt !== null ||
    resetToken.expiresAt.getTime() <= now.getTime() ||
    resetToken.customerAccount.status !== "ACTIVE"
  ) {
    throw invalidRecovery();
  }

  const nextPasswordHash = await hashPassword(input.newPassword);

  try {
    await prisma.$transaction(async (transaction) => {
      const consumed = await transaction.customerPasswordResetToken.updateMany({
        data: { usedAt: now },
        where: {
          id: resetToken.id,
          usedAt: null,
          expiresAt: { gt: now }
        }
      });

      if (consumed.count !== 1) throw invalidRecovery();

      const customerUpdate = await transaction.customerAccount.updateMany({
        data: { passwordHash: nextPasswordHash },
        where: {
          id: resetToken.customerAccountId,
          status: "ACTIVE"
        }
      });

      if (customerUpdate.count !== 1) throw invalidRecovery();

      await transaction.customerPasswordResetToken.updateMany({
        data: { usedAt: now },
        where: {
          customerAccountId: resetToken.customerAccountId,
          usedAt: null
        }
      });

      await transaction.customerSession.updateMany({
        data: { revokedAt: now },
        where: {
          customerAccountId: resetToken.customerAccountId,
          revokedAt: null
        }
      });
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw error;
  }
}
