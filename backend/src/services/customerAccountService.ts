import { Prisma, type CustomerAccount } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import {
  customerPasswordChangeSchema,
  customerProfileUpdateSchema,
  customerSessionRevokeOthersSchema,
  customerUsernameClaimSchema,
  type CustomerPasswordChangeInput,
  type CustomerProfileUpdateInput,
  type CustomerSessionRevokeOthersInput,
  type CustomerUsernameClaimInput
} from "../validators/customerAccount.validators.js";
import {
  createCustomerSessionMaterial,
  hashCustomerSessionToken,
  type CustomerSessionToken,
  type SafeCustomer
} from "./customerAuthService.js";
import { hashPassword, verifyPassword } from "./passwordHashService.js";

const REAUTHENTICATION_FAILED = {
  code: "CUSTOMER_REAUTHENTICATION_FAILED",
  message: "Current password is incorrect."
} as const;
const USERNAME_UNAVAILABLE = {
  code: "CUSTOMER_USERNAME_UNAVAILABLE",
  message: "That username is unavailable."
} as const;

export type CustomerSessionSummary = {
  id: string;
  current: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date;
};

function toSafeCustomer(customer: CustomerAccount): SafeCustomer {
  return {
    id: customer.id,
    name: customer.name,
    username: customer.username,
    email: customer.email,
    phone: customer.phone,
    status: customer.status
  };
}

function invalidSession(): HttpError {
  return new HttpError(401, "Customer session is invalid or expired.", {
    code: "CUSTOMER_SESSION_INVALID"
  });
}

function reauthenticationFailed(): HttpError {
  return new HttpError(401, REAUTHENTICATION_FAILED.message, {
    code: REAUTHENTICATION_FAILED.code
  });
}

function usernameUnavailable(): HttpError {
  return new HttpError(409, USERNAME_UNAVAILABLE.message, {
    code: USERNAME_UNAVAILABLE.code
  });
}

function usernameAlreadySet(): HttpError {
  return new HttpError(409, "Username can only be claimed once.", {
    code: "CUSTOMER_USERNAME_ALREADY_SET"
  });
}

async function requireActiveCustomer(customerAccountId: string): Promise<CustomerAccount> {
  const customer = await prisma.customerAccount.findUnique({ where: { id: customerAccountId } });
  if (!customer || customer.status !== "ACTIVE") {
    throw invalidSession();
  }
  return customer;
}

async function requireActiveSession(
  customerAccountId: string,
  sessionToken: string,
  now = new Date()
) {
  const session = await prisma.customerSession.findFirst({
    where: {
      customerAccountId,
      tokenHash: hashCustomerSessionToken(sessionToken),
      revokedAt: null,
      expiresAt: { gt: now }
    }
  });

  if (!session) throw invalidSession();
  return session;
}

async function requireCurrentPassword(
  customer: CustomerAccount,
  currentPassword: string
): Promise<string> {
  if (!customer.passwordHash) throw reauthenticationFailed();
  const matches = await verifyPassword(currentPassword, customer.passwordHash);
  if (!matches) throw reauthenticationFailed();
  return customer.passwordHash;
}

export async function updateCustomerProfile(
  customerAccountId: string,
  input: CustomerProfileUpdateInput
): Promise<SafeCustomer> {
  const parsed = customerProfileUpdateSchema.parse(input);
  await requireActiveCustomer(customerAccountId);

  const customer = await prisma.customerAccount.update({
    data: { name: parsed.name },
    where: { id: customerAccountId }
  });

  return toSafeCustomer(customer);
}

export async function claimCustomerUsername(
  customerAccountId: string,
  input: CustomerUsernameClaimInput
): Promise<SafeCustomer> {
  const parsed = customerUsernameClaimSchema.parse(input);
  const customer = await requireActiveCustomer(customerAccountId);

  if (customer.username !== null) throw usernameAlreadySet();
  await requireCurrentPassword(customer, parsed.currentPassword);

  try {
    const result = await prisma.customerAccount.updateMany({
      data: { username: parsed.username },
      where: {
        id: customerAccountId,
        username: null
      }
    });

    if (result.count !== 1) throw usernameAlreadySet();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw usernameUnavailable();
    }
    throw error;
  }

  const updated = await prisma.customerAccount.findUnique({ where: { id: customerAccountId } });
  if (!updated) throw invalidSession();
  return toSafeCustomer(updated);
}

export async function changeCustomerPassword(
  customerAccountId: string,
  sessionToken: string,
  input: CustomerPasswordChangeInput,
  now = new Date()
): Promise<CustomerSessionToken & { customer: SafeCustomer }> {
  const parsed = customerPasswordChangeSchema.parse(input);
  await requireActiveSession(customerAccountId, sessionToken, now);
  const customer = await requireActiveCustomer(customerAccountId);
  const currentPasswordHash = await requireCurrentPassword(customer, parsed.currentPassword);

  const nextPasswordHash = await hashPassword(parsed.newPassword);
  const nextSession = createCustomerSessionMaterial(now);

  const updatedCustomer = await prisma.$transaction(async (transaction) => {
    const passwordUpdate = await transaction.customerAccount.updateMany({
      data: { passwordHash: nextPasswordHash },
      where: {
        id: customerAccountId,
        passwordHash: currentPasswordHash,
        status: "ACTIVE"
      }
    });

    if (passwordUpdate.count !== 1) {
      throw reauthenticationFailed();
    }

    await transaction.customerSession.updateMany({
      data: { revokedAt: now },
      where: {
        customerAccountId,
        revokedAt: null
      }
    });
    await transaction.customerSession.create({
      data: {
        customerAccountId,
        tokenHash: nextSession.tokenHash,
        expiresAt: nextSession.expiresAt
      }
    });

    return transaction.customerAccount.findUniqueOrThrow({ where: { id: customerAccountId } });
  });

  return {
    customer: toSafeCustomer(updatedCustomer),
    sessionToken: nextSession.sessionToken,
    expiresAt: nextSession.expiresAt
  };
}

export async function listCustomerSessions(
  customerAccountId: string,
  sessionToken: string,
  now = new Date()
): Promise<CustomerSessionSummary[]> {
  const currentSession = await requireActiveSession(customerAccountId, sessionToken, now);

  const sessions = await prisma.customerSession.findMany({
    orderBy: { createdAt: "desc" },
    where: {
      customerAccountId,
      revokedAt: null,
      expiresAt: { gt: now }
    }
  });

  return sessions.map((session) => ({
    id: session.id,
    current: session.id === currentSession.id,
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    expiresAt: session.expiresAt
  }));
}

export async function revokeOtherCustomerSessions(
  customerAccountId: string,
  sessionToken: string,
  input: CustomerSessionRevokeOthersInput,
  now = new Date()
): Promise<number> {
  const parsed = customerSessionRevokeOthersSchema.parse(input);
  const currentSession = await requireActiveSession(customerAccountId, sessionToken, now);
  const customer = await requireActiveCustomer(customerAccountId);
  await requireCurrentPassword(customer, parsed.currentPassword);

  const result = await prisma.customerSession.updateMany({
    data: { revokedAt: now },
    where: {
      customerAccountId,
      id: { not: currentSession.id },
      revokedAt: null,
      createdAt: { lte: now },
      expiresAt: { gt: now }
    }
  });

  return result.count;
}
