import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";

const createdCustomerIds: string[] = [];

test("customer account and finite session persist independently from internal users", async () => {
  const suffix = randomUUID().slice(0, 8);
  const customer = await prisma.customerAccount.create({
    data: {
      name: "Customer Auth Test",
      email: `customer-auth-${suffix}@example.com`,
      phone: "09171234567",
      passwordHash: "scrypt$test-placeholder",
      status: "ACTIVE"
    }
  });
  createdCustomerIds.push(customer.id);

  const expiresAt = new Date(Date.now() + 60_000);
  const session = await prisma.customerSession.create({
    data: {
      customerAccountId: customer.id,
      tokenHash: randomUUID().replaceAll("-", ""),
      expiresAt
    }
  });

  assert.equal(session.customerAccountId, customer.id);
  assert.equal(session.revokedAt, null);
  assert.equal(session.expiresAt.getTime(), expiresAt.getTime());
});

test.after(async () => {
  await prisma.customerSession.deleteMany({
    where: { customerAccountId: { in: createdCustomerIds } }
  });
  await prisma.customerAccount.deleteMany({
    where: { id: { in: createdCustomerIds } }
  });
});
