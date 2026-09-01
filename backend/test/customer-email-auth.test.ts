import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import test from "node:test";

import { env } from "../src/config/env.js";
import { prisma } from "../src/database/prismaClient.js";
import {
  requestCustomerEmailAuth,
  verifyCustomerEmailAuth
} from "../src/services/customerEmailAuthService.js";

const testEmails = new Set<string>();

function otpSecret(): string {
  const secret = env.JWT_SECRET?.trim();
  assert.ok(secret);
  return secret;
}

function emailOtpHash(challengeId: string, email: string, verificationCode: string): string {
  return createHmac("sha256", otpSecret())
    .update(`customer-email-auth-otp:v1:${challengeId}:${email}:${verificationCode}`)
    .digest("hex");
}

function newQuickSignEmail(): string {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
  const email = `quick-sign-${suffix}@example.com`;
  testEmails.add(email);
  return email;
}

test("email Quick Sign uses a dedicated authentication challenge model", () => {
  assert.ok(prisma.customerEmailAuthChallenge);
});

test("new email Quick Sign request creates an OTP challenge before an account exists", async () => {
  const email = newQuickSignEmail();
  assert.equal(await prisma.customerAccount.findUnique({ where: { email } }), null);

  await requestCustomerEmailAuth({ email }, new Date());

  const challenge = await prisma.customerEmailAuthChallenge.findFirst({
    where: { emailNormalized: email, consumedAt: null },
    orderBy: { createdAt: "desc" }
  });
  assert.ok(challenge, "Expected a new email to receive an Email Quick Sign challenge.");
  assert.equal(challenge.customerAccountId, null);
});

test("verified new email Quick Sign creates a minimal verified account and session", async () => {
  const email = newQuickSignEmail();
  const expectedName = email.slice(0, email.indexOf("@"));
  const now = new Date("2026-09-01T02:30:00.000Z");
  const verificationCode = "731942";
  const challengeId = `email-auth-otp:${randomUUID().replaceAll("-", "")}`;

  await prisma.customerEmailAuthChallenge.create({
    data: {
      id: challengeId,
      customerAccountId: null,
      emailNormalized: email,
      otpHash: emailOtpHash(challengeId, email, verificationCode),
      expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
      createdAt: now
    }
  });

  const result = await verifyCustomerEmailAuth({ email, verificationCode }, now);
  assert.equal(result.customer.email, email);
  assert.equal(result.customer.name, expectedName);
  assert.equal(result.customer.username, null);
  assert.equal(result.customer.phone, null);

  const created = await prisma.customerAccount.findUnique({ where: { email } });
  assert.ok(created);
  assert.equal(created.status, "ACTIVE");
  assert.equal(created.name, expectedName);
  assert.equal(created.username, null);
  assert.equal(created.phone, null);
  assert.equal(created.phoneNormalized, null);
  assert.equal(created.passwordHash, null);
  assert.equal(created.emailVerifiedAt?.getTime(), now.getTime());
  assert.equal(created.phoneVerifiedAt, null);

  assert.equal(
    await prisma.customerSession.count({
      where: { customerAccountId: created.id, revokedAt: null }
    }),
    1
  );
  const consumedChallenge = await prisma.customerEmailAuthChallenge.findUnique({
    where: { id: challengeId }
  });
  assert.equal(consumedChallenge?.consumedAt?.getTime(), now.getTime());
});

test.after(async () => {
  const emails = [...testEmails];
  if (emails.length === 0) return;

  await prisma.customerEmailAuthChallenge.deleteMany({
    where: { emailNormalized: { in: emails } }
  });
  const customers = await prisma.customerAccount.findMany({
    where: { email: { in: emails } },
    select: { id: true }
  });
  const customerIds = customers.map((customer) => customer.id);
  if (customerIds.length > 0) {
    await prisma.customerSession.deleteMany({ where: { customerAccountId: { in: customerIds } } });
    await prisma.customerAccount.deleteMany({ where: { id: { in: customerIds } } });
  }
});
