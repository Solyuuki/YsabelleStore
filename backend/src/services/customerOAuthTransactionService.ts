import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual
} from "node:crypto";

import type { CustomerOAuthTransport, CustomerSocialProvider } from "@prisma/client";

import { env } from "../config/env.js";
import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";

const OAUTH_TRANSACTION_LIFETIME_MS = 10 * 60 * 1000;
const OAUTH_HANDOFF_LIFETIME_MS = 90 * 1000;
const AES_GCM_IV_BYTES = 12;
const AES_GCM_TAG_BYTES = 16;

function invalidCallback(): HttpError {
  return new HttpError(400, "Customer social authentication callback is invalid or expired.", {
    code: "SOCIAL_AUTH_INVALID_CALLBACK"
  });
}

function invalidHandoff(): HttpError {
  return new HttpError(400, "Customer social authentication handoff is invalid or expired.", {
    code: "SOCIAL_AUTH_HANDOFF_INVALID"
  });
}

function hashHex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function challenge(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function encryptionKey(): Buffer {
  const configured = env.CUSTOMER_OAUTH_TRANSACTION_KEY?.trim();
  if (!configured) {
    throw new Error("Customer OAuth transaction encryption key is not configured.");
  }
  return createHash("sha256").update(configured).digest();
}

function encryptSecret(value: string): string {
  const iv = randomBytes(AES_GCM_IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

function decryptSecret(value: string): string {
  const [ivEncoded, tagEncoded, ciphertextEncoded, ...extra] = value.split(".");
  if (!ivEncoded || !tagEncoded || !ciphertextEncoded || extra.length > 0) throw invalidCallback();

  try {
    const iv = Buffer.from(ivEncoded, "base64url");
    const tag = Buffer.from(tagEncoded, "base64url");
    const ciphertext = Buffer.from(ciphertextEncoded, "base64url");
    if (iv.length !== AES_GCM_IV_BYTES || tag.length !== AES_GCM_TAG_BYTES) throw invalidCallback();

    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw invalidCallback();
  }
}

function equalChallenge(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export type CreateCustomerOAuthTransactionInput = {
  provider: CustomerSocialProvider;
  transport: CustomerOAuthTransport;
  returnPath?: string;
  electronChallenge?: string;
};

export type CustomerOAuthTransactionMaterial = {
  transactionId: string;
  state: string;
  browserBinding: string;
  pkceVerifier: string;
  pkceChallenge: string;
  nonce: string | null;
  expiresAt: Date;
};

export async function createCustomerOAuthTransaction(
  input: CreateCustomerOAuthTransactionInput,
  now = new Date()
): Promise<CustomerOAuthTransactionMaterial> {
  const state = randomBytes(32).toString("base64url");
  const browserBinding = randomBytes(32).toString("base64url");
  const pkceVerifier = randomBytes(48).toString("base64url");
  const nonce = input.provider === "GOOGLE" ? randomBytes(32).toString("base64url") : null;
  const expiresAt = new Date(now.getTime() + OAUTH_TRANSACTION_LIFETIME_MS);
  const returnPath = input.returnPath?.startsWith("/") ? input.returnPath.slice(0, 255) : "/";

  const transaction = await prisma.customerOAuthTransaction.create({
    data: {
      provider: input.provider,
      transport: input.transport,
      stateHash: hashHex(state),
      browserBindingHash: input.transport === "WEB" ? hashHex(browserBinding) : null,
      pkceVerifierCiphertext: encryptSecret(pkceVerifier),
      nonceCiphertext: nonce ? encryptSecret(nonce) : null,
      nonceHash: nonce ? hashHex(nonce) : null,
      electronChallenge: input.transport === "ELECTRON" ? (input.electronChallenge ?? null) : null,
      returnPath,
      expiresAt
    }
  });

  return {
    transactionId: transaction.id,
    state,
    browserBinding,
    pkceVerifier,
    pkceChallenge: challenge(pkceVerifier),
    nonce,
    expiresAt
  };
}

export async function consumeCustomerOAuthTransaction(
  input: {
    provider: CustomerSocialProvider;
    transport: CustomerOAuthTransport;
    state: string;
    browserBinding?: string;
  },
  now = new Date()
): Promise<{
  transactionId: string;
  provider: CustomerSocialProvider;
  transport: CustomerOAuthTransport;
  pkceVerifier: string;
  nonce: string | null;
  electronChallenge: string | null;
  returnPath: string;
}> {
  if (!input.state) throw invalidCallback();

  const transaction = await prisma.customerOAuthTransaction.findUnique({
    where: { stateHash: hashHex(input.state) }
  });

  if (
    !transaction ||
    transaction.provider !== input.provider ||
    transaction.transport !== input.transport ||
    transaction.consumedAt !== null ||
    transaction.expiresAt.getTime() <= now.getTime()
  ) {
    throw invalidCallback();
  }

  if (input.transport === "WEB") {
    if (!transaction.browserBindingHash || !input.browserBinding) throw invalidCallback();
    if (!equalChallenge(transaction.browserBindingHash, hashHex(input.browserBinding))) {
      throw invalidCallback();
    }
  }

  const consumed = await prisma.customerOAuthTransaction.updateMany({
    data: { consumedAt: now },
    where: {
      id: transaction.id,
      consumedAt: null,
      expiresAt: { gt: now }
    }
  });
  if (consumed.count !== 1) throw invalidCallback();

  return {
    transactionId: transaction.id,
    provider: transaction.provider,
    transport: transaction.transport,
    pkceVerifier: decryptSecret(transaction.pkceVerifierCiphertext),
    nonce: transaction.nonceCiphertext ? decryptSecret(transaction.nonceCiphertext) : null,
    electronChallenge: transaction.electronChallenge,
    returnPath: transaction.returnPath
  };
}

export async function createCustomerOAuthHandoff(
  customerAccountId: string,
  verifierChallenge: string,
  now = new Date()
): Promise<{ code: string; expiresAt: Date }> {
  if (!verifierChallenge || verifierChallenge.length < 43 || verifierChallenge.length > 86) {
    throw invalidHandoff();
  }

  const code = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + OAUTH_HANDOFF_LIFETIME_MS);
  await prisma.customerOAuthHandoff.create({
    data: {
      customerAccountId,
      codeHash: hashHex(code),
      verifierChallenge,
      expiresAt
    }
  });

  return { code, expiresAt };
}

export async function redeemCustomerOAuthHandoff(
  input: { code: string; verifier: string },
  now = new Date()
): Promise<string> {
  if (!input.code || !input.verifier) throw invalidHandoff();

  const handoff = await prisma.customerOAuthHandoff.findUnique({
    include: { customerAccount: true },
    where: { codeHash: hashHex(input.code) }
  });
  if (
    !handoff ||
    handoff.usedAt !== null ||
    handoff.expiresAt.getTime() <= now.getTime() ||
    handoff.customerAccount.status !== "ACTIVE" ||
    !equalChallenge(handoff.verifierChallenge, challenge(input.verifier))
  ) {
    throw invalidHandoff();
  }

  const consumed = await prisma.customerOAuthHandoff.updateMany({
    data: { usedAt: now },
    where: {
      id: handoff.id,
      usedAt: null,
      expiresAt: { gt: now }
    }
  });
  if (consumed.count !== 1) throw invalidHandoff();

  return handoff.customerAccountId;
}
