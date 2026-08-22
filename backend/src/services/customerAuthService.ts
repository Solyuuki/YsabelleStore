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
import { hashPassword, verifyPassword } from "./passwordHashService.js";

const CUSTOMER_SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const INVALID_CREDENTIALS = {
  code: "INVALID_CUSTOMER_CREDENTIALS",
  message: "Invalid email or password."
} as const;
const INVALID_SESSION = {
  code: "CUSTOMER_SESSION_INVALID",
  message: "Customer session is invalid or expired."
} as const;

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

export async function registerCustomer(input: CustomerRegisterInput): Promise<CustomerSessionResult> {
  const parsed = customerRegisterSchema.parse(input);
  const email = parsed.email;
  const existing = await prisma.customerAccount.findUnique({ where: { email } });

  if (existing) {
    throw new HttpError(409, "An account with this email already exists.", {
      code: "CUSTOMER_EMAIL_ALREADY_REGISTERED"
    });
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
      throw new HttpError(409, "An account with this email already exists.", {
        code: "CUSTOMER_EMAIL_ALREADY_REGISTERED"
      });
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
    throw invalidCredentials();
  }

  const passwordMatches = await verifyPassword(parsed.password, customer.passwordHash);
  if (!passwordMatches) {
    throw invalidCredentials();
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
