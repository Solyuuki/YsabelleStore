import { createHash, randomBytes } from "node:crypto";

import { Prisma, type CustomerAccount } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import {
  customerLoginSchema,
  customerRegisterSchema,
  type CustomerLoginInput,
  type CustomerRegisterInput
} from "../validators/customerAuth.validators.js";
import {
  hashPassword,
  passwordHashNeedsUpgrade,
  verifyPassword
} from "./passwordHashService.js";

const CUSTOMER_SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const INVALID_CREDENTIALS = {
  code: "INVALID_CUSTOMER_CREDENTIALS",
  message: "Invalid credentials."
} as const;
const INVALID_SESSION = {
  code: "CUSTOMER_SESSION_INVALID",
  message: "Customer session is invalid or expired."
} as const;
const CUSTOMER_ACCOUNT_CONFLICT = {
  code: "CUSTOMER_ACCOUNT_CONFLICT",
  message: "Unable to create customer account with the supplied details."
} as const;

const DUMMY_PASSWORD_HASH_PROMISE = hashPassword(randomBytes(32).toString("base64url"));

export type SafeCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: "ACTIVE" | "INACTIVE";
};

export type CustomerSessionToken = {
  sessionToken: string;
  expiresAt: Date;
};

export type CustomerSessionResult = CustomerSessionToken & {
  customer: SafeCustomer;
};

function toSafeCustomer(customer: CustomerAccount): SafeCustomer {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    status: customer.status
  };
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function invalidCredentials(): HttpError {
  return new HttpError(401, INVALID_CREDENTIALS.message, {
    code: INVALID_CREDENTIALS.code
  });
}

function invalidSession(): HttpError {
  return new HttpError(401, INVALID_SESSION.message, {
    code: INVALID_SESSION.code
  });
}

function customerAccountConflict(): HttpError {
  return new HttpError(409, CUSTOMER_ACCOUNT_CONFLICT.message, {
    code: CUSTOMER_ACCOUNT_CONFLICT.code
  });
}

export async function createCustomerSession(
  customerAccountId: string,
  now = new Date()
): Promise<CustomerSessionToken> {
  const sessionToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + CUSTOMER_SESSION_LIFETIME_MS);

  await prisma.customerSession.create({
    data: {
      customerAccountId,
      tokenHash: hashSessionToken(sessionToken),
      expiresAt
    }
  });

  return { sessionToken, expiresAt };
}

export async function registerCustomer(
  input: CustomerRegisterInput
): Promise<CustomerSessionResult> {
  const parsed = customerRegisterSchema.parse(input);
  const email = parsed.email;
  const existing = await prisma.customerAccount.findUnique({ where: { email } });

  if (existing) {
    throw customerAccountConflict();
  }

  let customer: CustomerAccount;
  try {
    customer = await prisma.customerAccount.create({
      data: {
        name: parsed.name,
        email,
        phone: parsed.phone ?? null,
        passwordHash: await hashPassword(parsed.password),
        status: "ACTIVE"
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw customerAccountConflict();
    }
    throw error;
  }

  const session = await createCustomerSession(customer.id);
  return {
    customer: toSafeCustomer(customer),
    ...session
  };
}

export async function loginCustomer(input: CustomerLoginInput): Promise<CustomerSessionResult> {
  const parsed = customerLoginSchema.parse(input);
  const customer = await prisma.customerAccount.findUnique({
    where: { email: parsed.email }
  });

  if (!customer || customer.status !== "ACTIVE") {
    const dummyHash = await DUMMY_PASSWORD_HASH_PROMISE;
    await verifyPassword(parsed.password, dummyHash);
    throw invalidCredentials();
  }

  const passwordMatches = await verifyPassword(parsed.password, customer.passwordHash);
  if (!passwordMatches) {
    throw invalidCredentials();
  }

  if (passwordHashNeedsUpgrade(customer.passwordHash)) {
    await prisma.customerAccount.update({
      data: { passwordHash: await hashPassword(parsed.password) },
      where: { id: customer.id }
    });
  }

  const session = await createCustomerSession(customer.id);
  return {
    customer: toSafeCustomer(customer),
    ...session
  };
}

export async function getCustomerFromSessionToken(
  sessionToken: string,
  now = new Date()
): Promise<SafeCustomer> {
  if (!sessionToken) {
    throw invalidSession();
  }

  const session = await prisma.customerSession.findUnique({
    include: { customerAccount: true },
    where: { tokenHash: hashSessionToken(sessionToken) }
  });

  if (
    !session ||
    session.revokedAt !== null ||
    session.expiresAt.getTime() <= now.getTime() ||
    session.customerAccount.status !== "ACTIVE"
  ) {
    throw invalidSession();
  }

  await prisma.customerSession.update({
    data: { lastUsedAt: now },
    where: { id: session.id }
  });

  return toSafeCustomer(session.customerAccount);
}

export async function revokeCustomerSession(sessionToken: string): Promise<void> {
  if (!sessionToken) return;

  const session = await prisma.customerSession.findUnique({
    where: { tokenHash: hashSessionToken(sessionToken) }
  });
  if (!session || session.revokedAt) return;

  await prisma.customerSession.update({
    data: { revokedAt: new Date() },
    where: { id: session.id }
  });
}
