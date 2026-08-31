import { Prisma, type CustomerRememberedAuthMethod } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { createCustomerSession, toSafeCustomer, type CustomerSessionResult } from "./customerAuthService.js";

export const CUSTOMER_REMEMBERED_TRUST_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
export const CUSTOMER_REMEMBERED_MAX_ACCOUNTS = 3;

export type CustomerRememberedAccount = {
  id: string;
  name: string;
  method: CustomerRememberedAuthMethod;
  maskedIdentifier: string;
  trusted: boolean;
  trustedUntil: string;
  lastUsedAt: string | null;
};

export type CustomerRememberedContinueResult =
  | { status: "authenticated"; session: CustomerSessionResult }
  | { status: "verification_required"; account: CustomerRememberedAccount }
  | { status: "invalid" };

function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@", 2);
  if (!domain) return "••••";
  const visible = local.slice(0, Math.min(3, local.length));
  return `${visible}${"•".repeat(Math.max(3, Math.min(6, local.length - visible.length || 3)))}@${domain}`;
}

function maskMobile(phone: string | null): string {
  if (!phone) return "09•••••••••";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `${digits.slice(0, 2)}${"•".repeat(Math.max(4, digits.length - 4))}${digits.slice(-2)}`;
}

function toRememberedAccount(
  row: {
    id: string;
    authMethod: CustomerRememberedAuthMethod;
    trustedUntil: Date;
    lastUsedAt: Date | null;
    customerAccount: {
      name: string;
      email: string;
      phoneNormalized: string | null;
    };
  },
  now: Date
): CustomerRememberedAccount {
  return {
    id: row.id,
    name: row.customerAccount.name,
    method: row.authMethod,
    maskedIdentifier:
      row.authMethod === "EMAIL"
        ? maskEmail(row.customerAccount.email)
        : maskMobile(row.customerAccount.phoneNormalized),
    trusted: row.trustedUntil.getTime() > now.getTime(),
    trustedUntil: row.trustedUntil.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null
  };
}

export async function listCustomerRememberedAccounts(
  browserTokenHash: string,
  now = new Date()
): Promise<CustomerRememberedAccount[]> {
  if (!browserTokenHash) return [];

  const rows = await prisma.customerRememberedAuth.findMany({
    where: { browserTokenHash },
    include: {
      customerAccount: {
        select: {
          name: true,
          email: true,
          phoneNormalized: true
        }
      }
    },
    orderBy: [{ lastUsedAt: "desc" }, { updatedAt: "desc" }],
    take: CUSTOMER_REMEMBERED_MAX_ACCOUNTS
  });

  return rows.map((row) => toRememberedAccount(row, now));
}

export async function rememberCustomerAccount(input: {
  authMethod: CustomerRememberedAuthMethod;
  browserTokenHash: string;
  customerAccountId: string;
  now?: Date;
}): Promise<{ remembered: boolean; slotLimitReached: boolean }> {
  const now = input.now ?? new Date();
  const trustedUntil = new Date(now.getTime() + CUSTOMER_REMEMBERED_TRUST_LIFETIME_MS);

  return prisma.$transaction(
    async (transaction) => {
      const existing = await transaction.customerRememberedAuth.findUnique({
        where: {
          browserTokenHash_customerAccountId: {
            browserTokenHash: input.browserTokenHash,
            customerAccountId: input.customerAccountId
          }
        }
      });

      if (existing) {
        await transaction.customerRememberedAuth.update({
          where: { id: existing.id },
          data: {
            authMethod: input.authMethod,
            trustedUntil,
            lastUsedAt: now
          }
        });
        return { remembered: true, slotLimitReached: false };
      }

      const count = await transaction.customerRememberedAuth.count({
        where: { browserTokenHash: input.browserTokenHash }
      });
      if (count >= CUSTOMER_REMEMBERED_MAX_ACCOUNTS) {
        return { remembered: false, slotLimitReached: true };
      }

      await transaction.customerRememberedAuth.create({
        data: {
          browserTokenHash: input.browserTokenHash,
          customerAccountId: input.customerAccountId,
          authMethod: input.authMethod,
          trustedUntil,
          lastUsedAt: now
        }
      });
      return { remembered: true, slotLimitReached: false };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

export async function continueRememberedCustomer(input: {
  browserTokenHash: string;
  rememberedAccountId: string;
  now?: Date;
}): Promise<CustomerRememberedContinueResult> {
  const now = input.now ?? new Date();
  const row = await prisma.customerRememberedAuth.findFirst({
    where: {
      id: input.rememberedAccountId,
      browserTokenHash: input.browserTokenHash
    },
    include: { customerAccount: true }
  });

  if (!row || row.customerAccount.status !== "ACTIVE") return { status: "invalid" };

  if (row.trustedUntil.getTime() <= now.getTime()) {
    return {
      status: "verification_required",
      account: toRememberedAccount(row, now)
    };
  }

  const sessionToken = await createCustomerSession(row.customerAccount.id, now);
  await prisma.customerRememberedAuth.updateMany({
    where: {
      id: row.id,
      browserTokenHash: input.browserTokenHash
    },
    data: { lastUsedAt: now }
  });

  return {
    status: "authenticated",
    session: {
      customer: toSafeCustomer(row.customerAccount),
      ...sessionToken
    }
  };
}

export async function forgetRememberedCustomer(input: {
  browserTokenHash: string;
  rememberedAccountId: string;
}): Promise<void> {
  await prisma.customerRememberedAuth.deleteMany({
    where: {
      id: input.rememberedAccountId,
      browserTokenHash: input.browserTokenHash
    }
  });
}

export async function expireRememberedTrustForCustomer(
  customerAccountId: string,
  now = new Date()
): Promise<void> {
  await prisma.customerRememberedAuth.updateMany({
    where: { customerAccountId },
    data: { trustedUntil: new Date(now.getTime() - 1) }
  });
}

export async function getCustomerRememberedAuthRow(input: {
  browserTokenHash: string;
  rememberedAccountId: string;
}) {
  return prisma.customerRememberedAuth.findFirst({
    where: {
      id: input.rememberedAccountId,
      browserTokenHash: input.browserTokenHash
    },
    include: { customerAccount: true }
  });
}
