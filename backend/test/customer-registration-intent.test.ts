import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createApp } from "../src/app.js";
import { prisma } from "../src/database/prismaClient.js";

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

async function cleanupCustomer(email: string) {
  const customer = await prisma.customerAccount.findUnique({ where: { email } });
  if (!customer) return;

  await prisma.customerSession.deleteMany({ where: { customerAccountId: customer.id } });
  await prisma.customerAccount.delete({ where: { id: customer.id } });
}

test("customer registration rejects a direct POST without a registration intent", async () => {
  const email = `registration-intent-${randomUUID().slice(0, 8)}@example.com`;

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/customer-auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Intent Guard Customer",
          email,
          password: "CustomerPass123!"
        })
      });
      const body = (await response.json()) as {
        success?: boolean;
        error?: { code?: string };
      };

      assert.equal(response.status, 403);
      assert.equal(body.success, false);
      assert.equal(body.error?.code, "CUSTOMER_REGISTRATION_INTENT_REQUIRED");
    });
  } finally {
    await cleanupCustomer(email);
  }
});
