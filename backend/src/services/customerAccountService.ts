import { Prisma, type CustomerAccount, type CustomerSocialProvider } from "@prisma/client";

import { env } from "../config/env.js";
import { prisma } from "../database/prismaClient.js";
import {
  CUSTOMER_PASSWORD_SETUP_MAX_CODE_ATTEMPTS,
  createCustomerPasswordSetupGrantMaterial,
  createCustomerPasswordSetupOtpMaterial,
  customerPasswordSetupAttemptMarkerId,
  customerPasswordSetupOtpMatches,
  hashCustomerPasswordSetupAttemptMarker,
  hashCustomerPasswordSetupGrant
} from "../utils/customerPasswordSetupOtp.js";
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

export type CustomerSecuritySummary = {
  hasPassword: boolean;
  linkedProviders: CustomerSocialProvider[];
  emailQuickSignAvailable: boolean;
};

export type CustomerPasswordSetupDelivery = {
  sendPasswordSetupEmail(input: {
    to: string;
    verificationCode: string;
    expiresAt: Date;
  }): Promise<void>;
};

function toSafeCustomer(customer: CustomerAccount): SafeCustomer {
  return {
    id: customer.id,
    name: customer.name,
    username: customer.username,
    email: customer.email,
    phone: customer.phone,
    defaultContactPhone: customer.defaultContactPhone,
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

function passwordAlreadySet(): HttpError {
  return new HttpError(409, "A password is already set for this customer account.", {
    code: "CUSTOMER_PASSWORD_ALREADY_SET"
  });
}

function invalidPasswordSetupCode(): HttpError {
  return new HttpError(400, "The verification code is invalid or expired. Request a new code.", {
    code: "CUSTOMER_PASSWORD_SETUP_CODE_INVALID"
  });
}

function invalidPasswordSetupGrant(): HttpError {
  return new HttpError(400, "This password setup session is invalid or expired.", {
    code: "CUSTOMER_PASSWORD_SETUP_INVALID"
  });
}

function passwordSetupSecret(): string {
  const secret = env.JWT_SECRET?.trim();
  if (!secret) throw new Error("Customer password setup OTP secret is not configured.");
  return secret;
}

async function recordPasswordSetupFailedAttempt(
  challenge: { id: string; customerAccountId: string; expiresAt: Date },
  now: Date
): Promise<never> {
  for (let attempt = 1; attempt <= CUSTOMER_PASSWORD_SETUP_MAX_CODE_ATTEMPTS; attempt += 1) {
    const markerId = customerPasswordSetupAttemptMarkerId(challenge.id, attempt);

    try {
      await prisma.customerPasswordResetToken.create({
        data: {
          id: markerId,
          customerAccountId: challenge.customerAccountId,
          tokenHash: hashCustomerPasswordSetupAttemptMarker(markerId),
          expiresAt: challenge.expiresAt,
          usedAt: now
        }
      });

      if (attempt === CUSTOMER_PASSWORD_SETUP_MAX_CODE_ATTEMPTS) {
        await prisma.customerPasswordResetToken.updateMany({
          data: { usedAt: now },
          where: { id: challenge.id, usedAt: null }
        });
      }

      throw invalidPasswordSetupCode();
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
  throw invalidPasswordSetupCode();
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

export async function getCustomerSecuritySummary(
  customerAccountId: string
): Promise<CustomerSecuritySummary> {
  const customer = await requireActiveCustomer(customerAccountId);
  const socialIdentities = await prisma.customerSocialIdentity.findMany({
    select: { provider: true },
    where: { customerAccountId }
  });

  return {
    hasPassword: customer.passwordHash !== null,
    linkedProviders: [...new Set(socialIdentities.map((identity) => identity.provider))],
    emailQuickSignAvailable: true
  };
}

export async function requestCustomerPasswordSetup(
  customerAccountId: string,
  delivery: CustomerPasswordSetupDelivery,
  now = new Date()
): Promise<void> {
  const customer = await requireActiveCustomer(customerAccountId);
  if (customer.passwordHash) throw passwordAlreadySet();

  const otp = createCustomerPasswordSetupOtpMaterial(passwordSetupSecret(), now);
  await prisma.$transaction(async (transaction) => {
    await transaction.customerPasswordResetToken.updateMany({
      data: { usedAt: now },
      where: {
        customerAccountId,
        id: { startsWith: "setup-" },
        usedAt: null
      }
    });

    await transaction.customerPasswordResetToken.create({
      data: {
        id: otp.challengeId,
        customerAccountId,
        tokenHash: otp.otpHash,
        expiresAt: otp.expiresAt
      }
    });
  });

  try {
    await delivery.sendPasswordSetupEmail({
      to: customer.email,
      verificationCode: otp.verificationCode,
      expiresAt: otp.expiresAt
    });
  } catch (error) {
    await prisma.customerPasswordResetToken.deleteMany({
      where: { id: otp.challengeId, usedAt: null }
    });
    throw error;
  }
}

export async function verifyCustomerPasswordSetupCode(
  customerAccountId: string,
  verificationCode: string,
  now = new Date()
): Promise<{ setupGrant: string; expiresAt: Date }> {
  const customer = await requireActiveCustomer(customerAccountId);
  if (customer.passwordHash) throw passwordAlreadySet();

  const challenge = await prisma.customerPasswordResetToken.findFirst({
    where: {
      customerAccountId,
      id: { startsWith: "setup-otp:" },
      usedAt: null,
      expiresAt: { gt: now }
    },
    orderBy: { createdAt: "desc" }
  });
  if (!challenge) throw invalidPasswordSetupCode();

  if (
    !customerPasswordSetupOtpMatches(
      passwordSetupSecret(),
      challenge.id,
      verificationCode,
      challenge.tokenHash
    )
  ) {
    return recordPasswordSetupFailedAttempt(challenge, now);
  }

  const grant = createCustomerPasswordSetupGrantMaterial(now);
  await prisma.$transaction(async (transaction) => {
    const consumed = await transaction.customerPasswordResetToken.updateMany({
      data: { usedAt: now },
      where: {
        id: challenge.id,
        usedAt: null,
        expiresAt: { gt: now }
      }
    });
    if (consumed.count !== 1) throw invalidPasswordSetupCode();

    await transaction.customerPasswordResetToken.create({
      data: {
        id: grant.grantId,
        customerAccountId,
        tokenHash: grant.grantHash,
        expiresAt: grant.expiresAt
      }
    });
  });

  return { setupGrant: grant.setupGrant, expiresAt: grant.expiresAt };
}

export async function setupCustomerPassword(
  customerAccountId: string,
  sessionToken: string,
  setupGrant: string,
  newPassword: string,
  now = new Date()
): Promise<SafeCustomer> {
  const currentSession = await requireActiveSession(customerAccountId, sessionToken, now);
  const customer = await requireActiveCustomer(customerAccountId);
  if (customer.passwordHash) throw passwordAlreadySet();
  if (
    !setupGrant ||
    setupGrant.length < 32 ||
    newPassword.length < 8 ||
    newPassword.length > 128
  ) {
    throw invalidPasswordSetupGrant();
  }

  const grantHash = hashCustomerPasswordSetupGrant(setupGrant);
  const grant = await prisma.customerPasswordResetToken.findUnique({
    where: { tokenHash: grantHash }
  });
  if (
    !grant ||
    !grant.id.startsWith("setup-grant:") ||
    grant.customerAccountId !== customerAccountId ||
    grant.usedAt !== null ||
    grant.expiresAt.getTime() <= now.getTime()
  ) {
    throw invalidPasswordSetupGrant();
  }

  const nextPasswordHash = await hashPassword(newPassword);
  const updatedCustomer = await prisma.$transaction(async (transaction) => {
    const consumed = await transaction.customerPasswordResetToken.updateMany({
      data: { usedAt: now },
      where: {
        id: grant.id,
        customerAccountId,
        usedAt: null,
        expiresAt: { gt: now }
      }
    });
    if (consumed.count !== 1) throw invalidPasswordSetupGrant();

    const updated = await transaction.customerAccount.updateMany({
      data: { passwordHash: nextPasswordHash },
      where: {
        id: customerAccountId,
        passwordHash: null,
        status: "ACTIVE"
      }
    });
    if (updated.count !== 1) throw passwordAlreadySet();

    await transaction.customerPasswordResetToken.updateMany({
      data: { usedAt: now },
      where: {
        customerAccountId,
        id: { startsWith: "setup-" },
        usedAt: null
      }
    });

    await transaction.customerSession.updateMany({
      data: { revokedAt: now },
      where: {
        customerAccountId,
        id: { not: currentSession.id },
        revokedAt: null
      }
    });

    return transaction.customerAccount.findUniqueOrThrow({ where: { id: customerAccountId } });
  });

  return toSafeCustomer(updatedCustomer);
}

export async function updateCustomerProfile(
  customerAccountId: string,
  input: CustomerProfileUpdateInput
): Promise<SafeCustomer> {
  const parsed = customerProfileUpdateSchema.parse(input);
  await requireActiveCustomer(customerAccountId);

  const customer = await prisma.customerAccount.update({
    data: {
      ...(parsed.name !== undefined ? { name: parsed.name } : {}),
      ...(parsed.defaultContactPhone !== undefined
        ? { defaultContactPhone: parsed.defaultContactPhone }
        : {})
    },
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
