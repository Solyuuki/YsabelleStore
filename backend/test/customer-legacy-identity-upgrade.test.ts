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
import {
  requestCustomerMobileAuth,
  verifyCustomerMobileAuth
} from "../src/services/customerMobileAuthService.js";
import { normalizePhilippineMobile } from "../src/utils/customerIdentity.js";

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

function mobileOtpHash(challengeId: string, phone: string, verificationCode: string) {
  return createHmac("sha256", otpSecret())
    .update(`customer-mobile-auth-otp:v1:${challengeId}:${phone}:${verificationCode}`)
    .digest("hex");
}

function testPhone(suffix: string) {
  const numeric = Number.parseInt(suffix.slice(0, 7), 16) % 10_000_000;
  return `0917${numeric.toString().padStart(7, "0")}`;
}

async function createLegacyCustomer(options: { withPhone?: boolean } = {}) {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
  const phone = options.withPhone ? testPhone(suffix) : undefined;
  const registered = await registerCustomer({
    name: "Legacy Customer",
    username: `legacy.${suffix}`,
    email: `legacy-${suffix}@example.com`,
    phone,
    password: "LegacyPassword123!"
  });
  createdCustomerIds.push(registered.customer.id);
  return { ...registered.customer, phone };
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

test("legacy customer with an unverified stored PH mobile can request Mobile Quick Sign", async () => {
  const customer = await createLegacyCustomer({ withPhone: true });
  const normalized = normalizePhilippineMobile(customer.phone ?? "");
  assert.ok(normalized);

  const before = await prisma.customerAccount.findUnique({ where: { id: customer.id } });
  assert.equal(before?.phoneVerifiedAt, null);

  const deliveries: string[] = [];
  await requestCustomerMobileAuth(
    { phone: normalized },
    async ({ verificationCode }) => {
      deliveries.push(verificationCode);
    },
    new Date()
  );

  assert.equal(deliveries.length, 1);
  assert.match(deliveries[0] ?? "", /^\d{6}$/);
  const challenge = await prisma.customerMobileAuthChallenge.findFirst({
    where: { customerAccountId: customer.id, phoneNormalized: normalized, consumedAt: null },
    orderBy: { createdAt: "desc" }
  });
  assert.ok(challenge, "Expected Mobile Quick Sign to create a challenge for a legacy account.");
});

test("successful Mobile Quick Sign upgrades a legacy stored PH mobile to verified", async () => {
  const customer = await createLegacyCustomer({ withPhone: true });
  const normalized = normalizePhilippineMobile(customer.phone ?? "");
  assert.ok(normalized);
  await prisma.customerSession.deleteMany({ where: { customerAccountId: customer.id } });

  const now = new Date("2026-08-31T13:05:00.000Z");
  const verificationCode = "135790";
  const challengeId = `mobile-otp:${randomUUID().replaceAll("-", "")}`;
  await prisma.customerMobileAuthChallenge.create({
    data: {
      id: challengeId,
      customerAccountId: customer.id,
      phoneNormalized: normalized,
      otpHash: mobileOtpHash(challengeId, normalized, verificationCode),
      expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
      createdAt: now
    }
  });

  const session = await verifyCustomerMobileAuth({ phone: normalized, verificationCode }, now);
  assert.equal(session.customer.id, customer.id);

  const upgraded = await prisma.customerAccount.findUnique({ where: { id: customer.id } });
  assert.equal(upgraded?.phoneVerifiedAt?.getTime(), now.getTime());
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
  await prisma.customerMobileAuthChallenge.deleteMany({
    where: { customerAccountId: { in: createdCustomerIds } }
  });
  await prisma.customerSession.deleteMany({
    where: { customerAccountId: { in: createdCustomerIds } }
  });
  await prisma.customerAccount.deleteMany({
    where: { id: { in: createdCustomerIds } }
  });
});
