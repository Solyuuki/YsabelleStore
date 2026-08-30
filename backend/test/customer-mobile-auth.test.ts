import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createApp } from "../src/app.js";
import { prisma } from "../src/database/prismaClient.js";
import { registerCustomer } from "../src/services/customerAuthService.js";

type ApiBody = {
  success?: boolean;
  message?: string;
  data?: unknown;
  error?: { code?: string };
};

const createdCustomerIds: string[] = [];

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const app = createApp();
  const server = app.listen(0, "127.0.0.1");

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });

    const address = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function json(response: Response): Promise<ApiBody> {
  return (await response.json()) as ApiBody;
}

function testPhone(suffix: string) {
  const numeric = Number.parseInt(suffix.slice(0, 7), 16) % 10_000_000;
  return `0917${numeric.toString().padStart(7, "0")}`;
}

test("mobile quick sign request accepts a PH mobile number with a privacy-safe response", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/customer-auth/mobile/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: "09171234567" })
    });

    assert.equal(response.status, 200);
    const body = await json(response);
    assert.equal(body.success, true);
    assert.equal(body.data, undefined);
    assert.equal(JSON.stringify(body).includes("09171234567"), false);
  });
});

test("mobile quick sign keeps OTP challenges in dedicated storage separate from recovery tokens", async () => {
  const rows = await prisma.$queryRaw<Array<{ tableName: string }>>`
    SELECT TABLE_NAME AS tableName
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'customer_mobile_auth_challenges'
  `;

  assert.equal(rows.length, 1);
});

test("mobile quick sign request creates a short-lived hashed challenge for the matching active customer", async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
  const phone = testPhone(suffix);
  const registered = await registerCustomer({
    name: "Mobile OTP Customer",
    username: `mobile.${suffix}`,
    email: `mobile-${suffix}@example.com`,
    phone,
    password: "MobilePassword123!"
  });
  createdCustomerIds.push(registered.customer.id);

  const before = Date.now();
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/customer-auth/mobile/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone })
    });
    assert.equal(response.status, 200);
  });
  const after = Date.now();

  const challenge = await prisma.customerMobileAuthChallenge.findFirst({
    where: {
      customerAccountId: registered.customer.id,
      phoneNormalized: phone,
      consumedAt: null
    },
    orderBy: { createdAt: "desc" }
  });

  assert.ok(challenge, "Expected a dedicated Mobile OTP challenge to be persisted.");
  assert.match(challenge.otpHash, /^[a-f0-9]{64}$/i);
  assert.equal(challenge.failedAttempts, 0);
  assert.equal(challenge.consumedAt, null);
  assert.ok(challenge.expiresAt.getTime() >= before + 9 * 60 * 1000);
  assert.ok(challenge.expiresAt.getTime() <= after + 11 * 60 * 1000);
});

test.after(async () => {
  if (createdCustomerIds.length === 0) return;

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
