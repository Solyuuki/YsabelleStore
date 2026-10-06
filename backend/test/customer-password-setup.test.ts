import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import {
  getCustomerSecuritySummary,
  requestCustomerPasswordSetup,
  setupCustomerPassword,
  verifyCustomerPasswordSetupCode,
  type CustomerPasswordSetupDelivery
} from "../src/services/customerAccountService.js";
import {
  createCustomerSession,
  hashCustomerSessionToken,
  loginCustomer
} from "../src/services/customerAuthService.js";
import { HttpError } from "../src/utils/httpError.js";

const createdCustomerIds: string[] = [];

function expectCode(code: string) {
  return (error: unknown) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.code, code);
    return true;
  };
}

function captureDelivery() {
  const deliveries: Array<{ to: string; verificationCode: string; expiresAt: Date }> = [];
  const delivery: CustomerPasswordSetupDelivery = {
    async sendPasswordSetupEmail(input) {
      deliveries.push(input);
    }
  };
  return { deliveries, delivery };
}

test("passwordless Quick Sign customer can add a password after OTP verification without losing the current session", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `passwordless-${suffix}@example.com`;
  const customer = await prisma.customerAccount.create({
    data: {
      name: "Passwordless Customer",
      email,
      passwordHash: null,
      status: "ACTIVE"
    }
  });
  createdCustomerIds.push(customer.id);

  const currentSession = await createCustomerSession(customer.id);
  const otherSession = await createCustomerSession(customer.id);
  const before = await getCustomerSecuritySummary(customer.id);
  assert.equal(before.hasPassword, false);

  const { deliveries, delivery } = captureDelivery();
  await requestCustomerPasswordSetup(customer.id, delivery);
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0]?.to, email);
  assert.match(deliveries[0]?.verificationCode ?? "", /^\d{6}$/);

  const grant = await verifyCustomerPasswordSetupCode(customer.id, deliveries[0]!.verificationCode);
  assert.ok(grant.setupGrant.length >= 32);

  const newPassword = "AddedPassword456!";
  const updated = await setupCustomerPassword(
    customer.id,
    currentSession.sessionToken,
    grant.setupGrant,
    newPassword
  );
  assert.equal(updated.id, customer.id);

  const persisted = await prisma.customerAccount.findUniqueOrThrow({
    where: { id: customer.id }
  });
  assert.ok(persisted.passwordHash);

  const after = await getCustomerSecuritySummary(customer.id);
  assert.equal(after.hasPassword, true);

  const currentPersisted = await prisma.customerSession.findFirst({
    where: {
      customerAccountId: customer.id,
      tokenHash: hashCustomerSessionToken(currentSession.sessionToken)
    }
  });
  const otherPersisted = await prisma.customerSession.findFirst({
    where: {
      customerAccountId: customer.id,
      tokenHash: hashCustomerSessionToken(otherSession.sessionToken)
    }
  });
  assert.equal(currentPersisted?.revokedAt, null);
  assert.ok(otherPersisted?.revokedAt);

  const login = await loginCustomer({ identifier: email, password: newPassword });
  assert.equal(login.customer.id, customer.id);

  await assert.rejects(
    requestCustomerPasswordSetup(customer.id, delivery),
    expectCode("CUSTOMER_PASSWORD_ALREADY_SET")
  );
});

test.after(async () => {
  if (createdCustomerIds.length === 0) return;
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
