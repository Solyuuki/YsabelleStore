import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createApp } from "../src/app.js";
import { prisma } from "../src/database/prismaClient.js";
import {
  continueRememberedCustomer,
  forgetRememberedCustomer,
  listCustomerRememberedAccounts,
  rememberCustomerAccount
} from "../src/services/customerRememberedAuthService.js";
import {
  CUSTOMER_REMEMBERED_BROWSER_COOKIE_NAME,
  createCustomerRememberedBrowserToken,
  hashCustomerRememberedBrowserToken
} from "../src/utils/customerRememberedAuthCookie.js";

const DAY_MS = 24 * 60 * 60 * 1000;

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

test("remembered quick sign API lists, continues, expires, and forgets only this browser's account", async () => {
  const browserToken = createCustomerRememberedBrowserToken();
  const browserTokenHash = hashCustomerRememberedBrowserToken(browserToken);
  const cookie = `${CUSTOMER_REMEMBERED_BROWSER_COOKIE_NAME}=${encodeURIComponent(browserToken)}`;
  const customer = await createCustomer(20);
  const now = new Date();

  try {
    await rememberCustomerAccount({
      authMethod: "EMAIL",
      browserTokenHash,
      customerAccountId: customer.id,
      now
    });
    const [remembered] = await listCustomerRememberedAccounts(browserTokenHash, now);
    assert.ok(remembered);

    await withServer(async (baseUrl) => {
      const listResponse = await fetch(`${baseUrl}/api/customer-auth/remembered`, {
        headers: { cookie }
      });
      assert.equal(listResponse.status, 200);
      const listBody = (await listResponse.json()) as {
        data?: { accounts?: Array<{ id: string; maskedIdentifier: string }> };
      };
      assert.equal(listBody.data?.accounts?.length, 1);
      assert.equal(listBody.data?.accounts?.[0]?.id, remembered.id);
      assert.equal(listBody.data?.accounts?.[0]?.maskedIdentifier.includes(customer.email), false);

      const continueResponse = await fetch(`${baseUrl}/api/customer-auth/remembered/continue`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ rememberedAccountId: remembered.id })
      });
      assert.equal(continueResponse.status, 200);
      const continueBody = (await continueResponse.json()) as {
        data?: { customer?: { id: string } };
      };
      assert.equal(continueBody.data?.customer?.id, customer.id);
      assert.match(continueResponse.headers.get("set-cookie") ?? "", /ysabelle_customer_session=/);

      await prisma.customerRememberedAuth.update({
        where: { id: remembered.id },
        data: { trustedUntil: new Date(Date.now() - 1_000) }
      });

      const expiredResponse = await fetch(`${baseUrl}/api/customer-auth/remembered/continue`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ rememberedAccountId: remembered.id })
      });
      assert.equal(expiredResponse.status, 200);
      const expiredBody = (await expiredResponse.json()) as {
        data?: { verificationRequired?: boolean; account?: { id: string } };
      };
      assert.equal(expiredBody.data?.verificationRequired, true);
      assert.equal(expiredBody.data?.account?.id, remembered.id);

      const forgetResponse = await fetch(
        `${baseUrl}/api/customer-auth/remembered/${encodeURIComponent(remembered.id)}`,
        { method: "DELETE", headers: { cookie } }
      );
      assert.equal(forgetResponse.status, 200);

      const afterForget = await listCustomerRememberedAccounts(browserTokenHash);
      assert.deepEqual(afterForget, []);
    });
  } finally {
    await prisma.customerRememberedAuth.deleteMany({ where: { browserTokenHash } });
    await prisma.customerSession.deleteMany({ where: { customerAccountId: customer.id } });
    await prisma.customerAccount.delete({ where: { id: customer.id } });
  }
});
