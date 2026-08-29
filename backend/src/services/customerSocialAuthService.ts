import { createHash, randomBytes } from "node:crypto";

import { Prisma, type CustomerAccount, type CustomerSocialProvider } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { normalizeCustomerEmail } from "../utils/customerIdentity.js";
import { HttpError } from "../utils/httpError.js";
import { createCustomerSession, type SafeCustomer } from "./customerAuthService.js";

const SOCIAL_LINK_INTENT_LIFETIME_MS = 10 * 60 * 1000;

export type CustomerSocialIdentityInput = {
  provider: CustomerSocialProvider;
  providerSubject: string;
  email: string | null;
  emailVerified: boolean;
  name: string;
};

export type CustomerSocialAuthResult =
  | {
      kind: "authenticated";
      customer: SafeCustomer;
      sessionToken: string;
      expiresAt: Date;
    }
  | {
      kind: "link_required";
      linkIntentToken: string;
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

export function hashCustomerSocialToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function socialError(
  statusCode: number,
  code: string,
  message = "Customer social authentication could not be completed."
): HttpError {
  return new HttpError(statusCode, message, { code });
}

function normalizeIdentity(input: CustomerSocialIdentityInput) {
  const providerSubject = input.providerSubject.trim();
  const name = input.name.trim();
  const email = input.email ? normalizeCustomerEmail(input.email) : null;

  if (!providerSubject || providerSubject.length > 191) {
    throw socialError(400, "SOCIAL_AUTH_INVALID_CALLBACK");
  }
  if (!email || !input.emailVerified) {
    throw socialError(400, "SOCIAL_AUTH_EMAIL_REQUIRED", "A verified provider email is required.");
  }

  return {
    provider: input.provider,
    providerSubject,
    email,
    emailVerified: true,
    name: name.slice(0, 120) || email.split("@")[0]!.slice(0, 120)
  };
}

async function authenticatedResult(customer: CustomerAccount): Promise<CustomerSocialAuthResult> {
  if (customer.status !== "ACTIVE") {
    throw socialError(403, "SOCIAL_AUTH_ACCOUNT_UNAVAILABLE", "Customer account is unavailable.");
  }

  const session = await createCustomerSession(customer.id);
  return {
    kind: "authenticated",
    customer: toSafeCustomer(customer),
    ...session
  };
}

async function createLinkIntent(
  customer: CustomerAccount,
  identity: ReturnType<typeof normalizeIdentity>,
  now: Date
): Promise<CustomerSocialAuthResult> {
  if (customer.status !== "ACTIVE") {
    throw socialError(403, "SOCIAL_AUTH_ACCOUNT_UNAVAILABLE", "Customer account is unavailable.");
  }

  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SOCIAL_LINK_INTENT_LIFETIME_MS);

  await prisma.$transaction(async (transaction) => {
    await transaction.customerSocialLinkIntent.updateMany({
      data: { usedAt: now },
      where: {
        customerAccountId: customer.id,
        provider: identity.provider,
        usedAt: null
      }
    });

    await transaction.customerSocialLinkIntent.create({
      data: {
        customerAccountId: customer.id,
        tokenHash: hashCustomerSocialToken(rawToken),
        provider: identity.provider,
        providerSubject: identity.providerSubject,
        providerEmail: identity.email,
        expiresAt
      }
    });
  });

  return {
    kind: "link_required",
    linkIntentToken: rawToken,
    expiresAt
  };
}

export async function authenticateCustomerSocialIdentity(
  input: CustomerSocialIdentityInput,
  now = new Date()
): Promise<CustomerSocialAuthResult> {
  const identity = normalizeIdentity(input);

  const linked = await prisma.customerSocialIdentity.findUnique({
    include: { customerAccount: true },
    where: {
      provider_providerSubject: {
        provider: identity.provider,
        providerSubject: identity.providerSubject
      }
    }
  });
  if (linked) {
    return authenticatedResult(linked.customerAccount);
  }

  const existingCustomer = await prisma.customerAccount.findUnique({
    where: { email: identity.email }
  });
  if (existingCustomer) {
    return createLinkIntent(existingCustomer, identity, now);
  }

  try {
    const customer = await prisma.$transaction(async (transaction) => {
      const createdCustomer = await transaction.customerAccount.create({
        data: {
          name: identity.name,
          username: null,
          email: identity.email,
          phone: null,
          phoneNormalized: null,
          passwordHash: null,
          status: "ACTIVE"
        }
      });

      await transaction.customerSocialIdentity.create({
        data: {
          customerAccountId: createdCustomer.id,
          provider: identity.provider,
          providerSubject: identity.providerSubject,
          providerEmail: identity.email,
          providerEmailVerified: identity.emailVerified
        }
      });

      return createdCustomer;
    });

    return authenticatedResult(customer);
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
      throw error;
    }

    const racedIdentity = await prisma.customerSocialIdentity.findUnique({
      include: { customerAccount: true },
      where: {
        provider_providerSubject: {
          provider: identity.provider,
          providerSubject: identity.providerSubject
        }
      }
    });
    if (racedIdentity) {
      return authenticatedResult(racedIdentity.customerAccount);
    }

    const racedCustomer = await prisma.customerAccount.findUnique({ where: { email: identity.email } });
    if (racedCustomer) {
      return createLinkIntent(racedCustomer, identity, now);
    }

    throw socialError(409, "SOCIAL_AUTH_LINK_CONFLICT");
  }
}

export async function completeCustomerSocialLink(input: {
  linkIntentToken: string;
  authenticatedCustomerId: string;
}, now = new Date()): Promise<void> {
  if (!input.linkIntentToken) {
    throw socialError(409, "SOCIAL_AUTH_LINK_CONFLICT");
  }

  const intent = await prisma.customerSocialLinkIntent.findUnique({
    include: { customerAccount: true },
    where: { tokenHash: hashCustomerSocialToken(input.linkIntentToken) }
  });

  if (
    !intent ||
    intent.usedAt !== null ||
    intent.expiresAt.getTime() <= now.getTime() ||
    intent.customerAccountId !== input.authenticatedCustomerId ||
    intent.customerAccount.status !== "ACTIVE"
  ) {
    throw socialError(409, "SOCIAL_AUTH_LINK_CONFLICT");
  }

  try {
    await prisma.$transaction(async (transaction) => {
      const consumed = await transaction.customerSocialLinkIntent.updateMany({
        data: { usedAt: now },
        where: {
          id: intent.id,
          usedAt: null,
          expiresAt: { gt: now }
        }
      });
      if (consumed.count !== 1) {
        throw socialError(409, "SOCIAL_AUTH_LINK_CONFLICT");
      }

      await transaction.customerSocialIdentity.create({
        data: {
          customerAccountId: intent.customerAccountId,
          provider: intent.provider,
          providerSubject: intent.providerSubject,
          providerEmail: intent.providerEmail,
          providerEmailVerified: true
        }
      });
    });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw socialError(409, "SOCIAL_AUTH_LINK_CONFLICT");
    }
    throw error;
  }
}
