import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import {
  requestCustomerPasswordRecovery,
  resetCustomerPassword,
  type CustomerRecoveryEmailDelivery
} from "../src/services/customerPasswordRecoveryService.js";
import { loginCustomer, registerCustomer } from "../src/services/customerAuthService.js";

const createdCustomerIds: string[] = [];

function recoveryDelivery() {
  let recoveryUrl = "";
  const delivery: CustomerRecoveryEmailDelivery = {
    async sendPasswordRecoveryEmail(input) {
      recoveryUrl = input.recoveryUrl;
    }
  };
  return { delivery, getRecoveryUrl: () => recoveryUrl };
}

test("two concurrent password resets using the same token produce exactly one success", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `concurrent-recovery-${suffix}@example.com`;
  const registered = await registerCustomer({
    name: "Concurrent Recovery Customer",
    username: `concurrent.recovery.${suffix}`,
    email,
    password: "OldPassword123!"
  });
  createdCustomerIds.push(registered.customer.id);

  const capture = recoveryDelivery();
  await requestCustomerPasswordRecovery({ identifier: email }, capture.delivery);
  const token = new URL(capture.getRecoveryUrl()).searchParams.get("token");
  assert.ok(token);

  const results = await Promise.allSettled([
    resetCustomerPassword({ token, newPassword: "ConcurrentPassword456!" }),
    resetCustomerPassword({ token, newPassword: "ConcurrentPassword789!" })
  ]);

  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);

  const passwordOutcomes = await Promise.allSettled([
    loginCustomer({ identifier: email, password: "ConcurrentPassword456!" }),
    loginCustomer({ identifier: email, password: "ConcurrentPassword789!" })
  ]);
  assert.equal(passwordOutcomes.filter((result) => result.status === "fulfilled").length, 1);
});

test.after(async () => {
  await prisma.customerPasswordResetToken.deleteMany({
    where: { customerAccountId: { in: createdCustomerIds } }
  });
  await prisma.customerSession.deleteMany({
    where: { customerAccountId: { in: createdCustomerIds } }
  });
  await prisma.customerAccount.deleteMany({
    where: { id: { in: createdCustomerIds } }
  });
});
