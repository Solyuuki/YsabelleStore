import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import test from "node:test";

import { env } from "../src/config/env.js";
import { prisma } from "../src/database/prismaClient.js";
import { registerCustomer } from "../src/services/customerAuthService.js";
import {
  requestCustomerEmailAuth,
  verifyCustomerEmailAuth
} from "../src/services/customerEmailAuthService.js";

const createdCustomerIds: string[] = [];

function otpSecret() {
  const secret = env.JWT_SECRET?.trim();
  assert.ok(secret);
  return secret;
}

function emailOtpHash(challengeId: string, email: string, verificationCode: string) {
  return createHmac("sha256", otpSecret())
    .update(`customer-email-auth-otp:v1:${challengeId}:${email}:${verificationCode}`)
    .digest("hex");
}

async function createLegacyCustomer() {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
  const registered = await registerCustomer({
    name: "Legacy Customer",
    username: `legacy.${suffix}`,
    email: `legacy-${suffix}@example.com`,
    password: "LegacyPassword123!"
  });
  createdCustomerIds.push(registered.customer.id);
  return registered.customer;
}

test("legacy customer with an unverified stored email can request Email Quick Sign", async () => {
  const customer = await createLegacyCustomer();
  const before = await prisma.customerAccount.findUnique({ where: { id: customer.id } });
  assert.equal(before?.emailVerifiedAt, null);

  await requestCustomerEmailAuth({ email: customer.email }, new Date());

  const challenge = await prisma.customerEmailAuthChallenge.findFirst({
    where: { customerAccountId: customer.id, emailNormalized: customer.email, consumedAt: null },
    orderBy: { createdAt: "desc" }
  });
  assert.ok(challenge, "Expected Email Quick Sign to create a challenge for a legacy account.");
});

test("successful Email Quick Sign upgrades a legacy stored email to verified", async () => {
  const customer = await createLegacyCustomer();
  await prisma.customerSession.deleteMany({ where: { customerAccountId: customer.id } });

  const now = new Date("2026-08-31T13:00:00.000Z");
  const verificationCode = "246810";
  const challengeId = `email-auth-otp:${randomUUID().replaceAll("-", "")}`;
  await prisma.customerEmailAuthChallenge.create({
    data: {
      id: challengeId,
      customerAccountId: customer.id,
      emailNormalized: customer.email,
      otpHash: emailOtpHash(challengeId, customer.email, verificationCode),
      expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
      createdAt: now
    }
  });

  const session = await verifyCustomerEmailAuth({ email: customer.email, verificationCode }, now);
  assert.equal(session.customer.id, customer.id);

  const upgraded = await prisma.customerAccount.findUnique({ where: { id: customer.id } });
  assert.equal(upgraded?.emailVerifiedAt?.getTime(), now.getTime());
  assert.equal(
    await prisma.customerSession.count({
      where: { customerAccountId: customer.id, revokedAt: null }
    }),
    1
  );
});

test.after(async () => {
  if (createdCustomerIds.length === 0) return;

  await prisma.customerEmailAuthChallenge.deleteMany({
    where: { customerAccountId: { in: createdCustomerIds } }
  });
  await prisma.customerSession.deleteMany({
    where: { customerAccountId: { in: createdCustomerIds } }
  });
  await prisma.customerAccount.deleteMany({
    where: { id: { in: createdCustomerIds } }
  });
});
