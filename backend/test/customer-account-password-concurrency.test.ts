import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import { changeCustomerPassword } from "../src/services/customerAccountService.js";
import { createCustomerSession } from "../src/services/customerAuthService.js";
import { hashPassword, verifyPassword } from "../src/services/passwordHashService.js";

const PASSWORD = "CustomerPass123!";
const FIRST_NEW_PASSWORD = "CustomerRaceOne123!";
const SECOND_NEW_PASSWORD = "CustomerRaceTwo123!";

test("concurrent password changes allow only one stale password state to win", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `account-password-race-${suffix}@example.com`;

  const customer = await prisma.customerAccount.create({
    data: {
      name: "Password Race Customer",
      username: `race.${suffix}`,
      email,
      passwordHash: await hashPassword(PASSWORD),
      status: "ACTIVE"
    }
  });

  try {
    const firstSession = await createCustomerSession(customer.id);
    const secondSession = await createCustomerSession(customer.id);

    const results = await Promise.allSettled([
      changeCustomerPassword(customer.id, firstSession.sessionToken, {
        currentPassword: PASSWORD,
        newPassword: FIRST_NEW_PASSWORD
      }),
      changeCustomerPassword(customer.id, secondSession.sessionToken, {
        currentPassword: PASSWORD,
        newPassword: SECOND_NEW_PASSWORD
      })
    ]);

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);

    const updatedCustomer = await prisma.customerAccount.findUniqueOrThrow({
      where: { id: customer.id }
    });
    assert.ok(updatedCustomer.passwordHash);
    const firstPasswordWon = await verifyPassword(FIRST_NEW_PASSWORD, updatedCustomer.passwordHash);
    const secondPasswordWon = await verifyPassword(
      SECOND_NEW_PASSWORD,
      updatedCustomer.passwordHash
    );
    assert.notEqual(firstPasswordWon, secondPasswordWon);

    const activeSessions = await prisma.customerSession.count({
      where: {
        customerAccountId: customer.id,
        revokedAt: null,
        expiresAt: { gt: new Date() }
      }
    });
    assert.equal(activeSessions, 1);
  } finally {
    await prisma.customerSession.deleteMany({ where: { customerAccountId: customer.id } });
    await prisma.customerAccount.delete({ where: { id: customer.id } });
  }
});
