import assert from "node:assert/strict";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import {
  continueRememberedCustomer,
  forgetRememberedCustomer,
  listCustomerRememberedAccounts,
  rememberCustomerAccount
} from "../src/services/customerRememberedAuthService.js";

const DAY_MS = 24 * 60 * 60 * 1000;

async function createCustomer(index: number) {
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return prisma.customerAccount.create({
    data: {
      name: `Remembered Customer ${index}`,
      email: `remembered-${index}-${nonce}@example.com`,
      emailVerifiedAt: new Date(),
      status: "ACTIVE"
    }
  });
}

test("customer remembered quick sign uses dedicated persisted trust rows", () => {
  assert.ok(prisma.customerRememberedAuth);
});

test("a browser remembers at most three distinct customer accounts and forget frees a slot", async () => {
  const browserTokenHash = `browser-${Date.now()}-${Math.random()}`;
  const now = new Date("2026-08-31T10:00:00.000Z");
  const customers = await Promise.all([1, 2, 3, 4].map(createCustomer));

  try {
    for (const customer of customers.slice(0, 3)) {
      const result = await rememberCustomerAccount({
        authMethod: "EMAIL",
        browserTokenHash,
        customerAccountId: customer.id,
        now
      });
      assert.equal(result.remembered, true);
      assert.equal(result.slotLimitReached, false);
    }

    const blocked = await rememberCustomerAccount({
      authMethod: "EMAIL",
      browserTokenHash,
      customerAccountId: customers[3]!.id,
      now
    });
    assert.equal(blocked.remembered, false);
    assert.equal(blocked.slotLimitReached, true);

    const existingRenewal = await rememberCustomerAccount({
      authMethod: "MOBILE",
      browserTokenHash,
      customerAccountId: customers[0]!.id,
      now: new Date(now.getTime() + DAY_MS)
    });
    assert.equal(existingRenewal.remembered, true);
    assert.equal(existingRenewal.slotLimitReached, false);

    const remembered = await listCustomerRememberedAccounts(browserTokenHash, now);
    assert.equal(remembered.length, 3);

    await forgetRememberedCustomer({
      browserTokenHash,
      rememberedAccountId: remembered[1]!.id
    });

    const admitted = await rememberCustomerAccount({
      authMethod: "EMAIL",
      browserTokenHash,
      customerAccountId: customers[3]!.id,
      now
    });
    assert.equal(admitted.remembered, true);
    assert.equal(admitted.slotLimitReached, false);
  } finally {
    await prisma.customerRememberedAuth.deleteMany({ where: { browserTokenHash } });
    await prisma.customerSession.deleteMany({
      where: { customerAccountId: { in: customers.map((customer) => customer.id) } }
    });
    await prisma.customerAccount.deleteMany({
      where: { id: { in: customers.map((customer) => customer.id) } }
    });
  }
});

test("trusted Continue does not extend the 30-day deadline and expired cards remain visible", async () => {
  const browserTokenHash = `browser-expiry-${Date.now()}-${Math.random()}`;
  const otherBrowserTokenHash = `browser-other-${Date.now()}-${Math.random()}`;
  const now = new Date("2026-08-31T10:00:00.000Z");
  const customer = await createCustomer(10);

  try {
    await rememberCustomerAccount({
      authMethod: "EMAIL",
      browserTokenHash,
      customerAccountId: customer.id,
      now
    });

    const [remembered] = await listCustomerRememberedAccounts(browserTokenHash, now);
    assert.ok(remembered);
    assert.equal(remembered.trusted, true);
    assert.equal(new Date(remembered.trustedUntil).getTime(), now.getTime() + 30 * DAY_MS);

    const continued = await continueRememberedCustomer({
      browserTokenHash,
      rememberedAccountId: remembered.id,
      now: new Date(now.getTime() + 29 * DAY_MS)
    });
    assert.equal(continued.status, "authenticated");

    const storedAfterContinue = await prisma.customerRememberedAuth.findUniqueOrThrow({
      where: { id: remembered.id }
    });
    assert.equal(storedAfterContinue.trustedUntil.getTime(), now.getTime() + 30 * DAY_MS);

    const expiredAt = new Date(now.getTime() + 31 * DAY_MS);
    const expiredContinue = await continueRememberedCustomer({
      browserTokenHash,
      rememberedAccountId: remembered.id,
      now: expiredAt
    });
    assert.equal(expiredContinue.status, "verification_required");

    const expiredList = await listCustomerRememberedAccounts(browserTokenHash, expiredAt);
    assert.equal(expiredList.length, 1);
    assert.equal(expiredList[0]!.trusted, false);

    const wrongBrowser = await continueRememberedCustomer({
      browserTokenHash: otherBrowserTokenHash,
      rememberedAccountId: remembered.id,
      now
    });
    assert.equal(wrongBrowser.status, "invalid");
  } finally {
    await prisma.customerRememberedAuth.deleteMany({
      where: { browserTokenHash: { in: [browserTokenHash, otherBrowserTokenHash] } }
    });
    await prisma.customerSession.deleteMany({ where: { customerAccountId: customer.id } });
    await prisma.customerAccount.delete({ where: { id: customer.id } });
  }
});
