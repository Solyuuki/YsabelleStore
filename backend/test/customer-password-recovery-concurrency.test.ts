import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import {
  requestCustomerPasswordRecovery,
  resetCustomerPassword,
  verifyCustomerPasswordRecoveryCode,
  type CustomerRecoveryEmailDelivery
} from "../src/services/customerPasswordRecoveryService.js";
import { loginCustomer, registerCustomer } from "../src/services/customerAuthService.js";

const createdCustomerIds: string[] = [];

function recoveryDelivery() {
  let verificationCode = "";
  const delivery: CustomerRecoveryEmailDelivery = {
    async sendPasswordRecoveryEmail(input) {
      verificationCode = input.verificationCode;
    }
  };
  return { delivery, getVerificationCode: () => verificationCode };
}

test("two concurrent OTP verifications produce exactly one recovery grant", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `concurrent-verify-${suffix}@example.com`;
  const registered = await registerCustomer({
    name: "Concurrent Verify Customer",
    username: `concurrent.verify.${suffix}`,
    email,
    password: "OldPassword123!"
  });
  createdCustomerIds.push(registered.customer.id);

  const capture = recoveryDelivery();
  await requestCustomerPasswordRecovery({ identifier: email }, capture.delivery);
  const verificationCode = capture.getVerificationCode();
  assert.match(verificationCode, /^\d{6}$/);

  const results = await Promise.allSettled([
    verifyCustomerPasswordRecoveryCode({ identifier: email, verificationCode }),
    verifyCustomerPasswordRecoveryCode({ identifier: email, verificationCode })
  ]);

  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
});

test("two concurrent password resets using the same recovery grant produce exactly one success", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `concurrent-reset-${suffix}@example.com`;
  const registered = await registerCustomer({
    name: "Concurrent Recovery Customer",
    username: `concurrent.recovery.${suffix}`,
    email,
    password: "OldPassword123!"
  });
  createdCustomerIds.push(registered.customer.id);

  const capture = recoveryDelivery();
  await requestCustomerPasswordRecovery({ identifier: email }, capture.delivery);
  const grant = await verifyCustomerPasswordRecoveryCode({
    identifier: email,
    verificationCode: capture.getVerificationCode()
  });

  const results = await Promise.allSettled([
    resetCustomerPassword({
      recoveryGrant: grant.recoveryGrant,
      newPassword: "ConcurrentPassword456!"
    }),
    resetCustomerPassword({
      recoveryGrant: grant.recoveryGrant,
      newPassword: "ConcurrentPassword789!"
    })
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
