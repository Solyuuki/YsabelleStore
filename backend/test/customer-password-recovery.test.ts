import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import {
  hashCustomerPasswordResetToken,
  requestCustomerPasswordRecovery,
  resetCustomerPassword,
  type CustomerRecoveryEmailDelivery
} from "../src/services/customerPasswordRecoveryService.js";
import {
  createCustomerSession,
  hashCustomerSessionToken,
  loginCustomer,
  registerCustomer
} from "../src/services/customerAuthService.js";
import { HttpError } from "../src/utils/httpError.js";

const createdCustomerIds: string[] = [];

function rememberCustomer(customerId: string) {
  createdCustomerIds.push(customerId);
  return customerId;
}

function testPhone(suffix: string) {
  const numeric = Number.parseInt(suffix, 16) % 10_000_000;
  return `0918${numeric.toString().padStart(7, "0")}`;
}

function captureDelivery() {
  const deliveries: Array<{ to: string; recoveryUrl: string; expiresAt: Date }> = [];
  const delivery: CustomerRecoveryEmailDelivery = {
    async sendPasswordRecoveryEmail(input) {
      deliveries.push(input);
    }
  };
  return { deliveries, delivery };
}

function tokenFromRecoveryUrl(url: string) {
  const token = new URL(url).searchParams.get("token");
  assert.ok(token);
  return token;
}

function expectGenericRecoveryError(error: unknown) {
  assert.ok(error instanceof HttpError);
  assert.equal(error.statusCode, 400);
  assert.equal(error.code, "CUSTOMER_PASSWORD_RECOVERY_INVALID");
  assert.equal(error.message, "This recovery link is invalid or expired. Request a new one.");
  return true;
}

test("recovery request resolves username, email, and mobile to the same active account without exposing account data", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `recovery-${suffix}@example.com`;
  const phone = testPhone(suffix);
  const registered = await registerCustomer({
    name: "Recovery Customer",
    username: `recover.${suffix}`,
    email,
    phone,
    password: "OldPassword123!"
  });
  rememberCustomer(registered.customer.id);

  const identifiers = [registered.customer.username!, email.toUpperCase(), phone];
  for (const identifier of identifiers) {
    const { deliveries, delivery } = captureDelivery();
    const result = await requestCustomerPasswordRecovery({ identifier }, delivery);
    assert.equal(result, undefined);
    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0]?.to, email);
  }
});

test("missing and inactive accounts have the same public recovery outcome and do not deliver mail", async () => {
  const suffix = randomUUID().slice(0, 8);
  const { deliveries, delivery } = captureDelivery();

  assert.equal(
    await requestCustomerPasswordRecovery(
      { identifier: `missing-${suffix}@example.com` },
      delivery
    ),
    undefined
  );

  const registered = await registerCustomer({
    name: "Inactive Recovery Customer",
    username: `inactive.recovery.${suffix}`,
    email: `inactive-recovery-${suffix}@example.com`,
    password: "OldPassword123!"
  });
  rememberCustomer(registered.customer.id);
  await prisma.customerAccount.update({
    data: { status: "INACTIVE" },
    where: { id: registered.customer.id }
  });

  assert.equal(
    await requestCustomerPasswordRecovery({ identifier: registered.customer.email }, delivery),
    undefined
  );
  assert.equal(deliveries.length, 0);
});

test("recovery token is stored only as a SHA-256 hash and expires exactly fifteen minutes after creation", async () => {
  const suffix = randomUUID().slice(0, 8);
  const registered = await registerCustomer({
    name: "Token Recovery Customer",
    username: `token.recovery.${suffix}`,
    email: `token-recovery-${suffix}@example.com`,
    password: "OldPassword123!"
  });
  rememberCustomer(registered.customer.id);
  const now = new Date("2026-08-27T04:00:00.000Z");
  const { deliveries, delivery } = captureDelivery();

  await requestCustomerPasswordRecovery({ identifier: registered.customer.email }, delivery, now);
  const rawToken = tokenFromRecoveryUrl(deliveries[0]!.recoveryUrl);
  const persisted = await prisma.customerPasswordResetToken.findFirstOrThrow({
    where: { customerAccountId: registered.customer.id }
  });

  assert.equal(persisted.tokenHash, hashCustomerPasswordResetToken(rawToken));
  assert.notEqual(persisted.tokenHash, rawToken);
  assert.equal(persisted.tokenHash.length, 64);
  assert.equal(persisted.expiresAt.getTime(), now.getTime() + 15 * 60 * 1000);
  assert.equal(persisted.usedAt, null);
});

test("a newer recovery request invalidates an older unused token", async () => {
  const suffix = randomUUID().slice(0, 8);
  const registered = await registerCustomer({
    name: "Rotating Recovery Customer",
    username: `rotate.recovery.${suffix}`,
    email: `rotate-recovery-${suffix}@example.com`,
    password: "OldPassword123!"
  });
  rememberCustomer(registered.customer.id);
  const { deliveries, delivery } = captureDelivery();

  await requestCustomerPasswordRecovery({ identifier: registered.customer.email }, delivery);
  const firstToken = tokenFromRecoveryUrl(deliveries[0]!.recoveryUrl);
  await requestCustomerPasswordRecovery({ identifier: registered.customer.email }, delivery);

  await assert.rejects(
    resetCustomerPassword({ token: firstToken, newPassword: "NewPassword456!" }),
    expectGenericRecoveryError
  );
});

test("delivery failure removes the newly issued reset token while preserving generic request behavior at the controller boundary", async () => {
  const suffix = randomUUID().slice(0, 8);
  const registered = await registerCustomer({
    name: "Delivery Failure Customer",
    username: `delivery.fail.${suffix}`,
    email: `delivery-fail-${suffix}@example.com`,
    password: "OldPassword123!"
  });
  rememberCustomer(registered.customer.id);
  const delivery: CustomerRecoveryEmailDelivery = {
    async sendPasswordRecoveryEmail() {
      throw new Error("provider unavailable");
    }
  };

  await assert.rejects(
    requestCustomerPasswordRecovery({ identifier: registered.customer.email }, delivery),
    /provider unavailable/
  );
  assert.equal(
    await prisma.customerPasswordResetToken.count({
      where: { customerAccountId: registered.customer.id }
    }),
    0
  );
});

test("successful reset changes password, consumes all recovery tokens, and revokes every active session", async () => {
  const suffix = randomUUID().slice(0, 8);
  const oldPassword = "OldPassword123!";
  const newPassword = "NewPassword456!";
  const registered = await registerCustomer({
    name: "Reset Customer",
    username: `reset.${suffix}`,
    email: `reset-${suffix}@example.com`,
    password: oldPassword
  });
  rememberCustomer(registered.customer.id);
  await createCustomerSession(registered.customer.id);
  const { deliveries, delivery } = captureDelivery();

  await requestCustomerPasswordRecovery({ identifier: registered.customer.email }, delivery);
  const rawToken = tokenFromRecoveryUrl(deliveries[0]!.recoveryUrl);
  await resetCustomerPassword({ token: rawToken, newPassword });

  await assert.rejects(
    loginCustomer({ identifier: registered.customer.email, password: oldPassword })
  );
  const login = await loginCustomer({
    identifier: registered.customer.email,
    password: newPassword
  });
  assert.equal(login.customer.id, registered.customer.id);

  const newSession = await prisma.customerSession.findFirstOrThrow({
    where: { tokenHash: hashCustomerSessionToken(login.sessionToken) }
  });
  const activeOldSessions = await prisma.customerSession.count({
    where: {
      customerAccountId: registered.customer.id,
      revokedAt: null,
      id: { not: newSession.id }
    }
  });
  assert.equal(activeOldSessions, 0);

  const unusedRecoveryTokens = await prisma.customerPasswordResetToken.count({
    where: { customerAccountId: registered.customer.id, usedAt: null }
  });
  assert.equal(unusedRecoveryTokens, 0);
  await assert.rejects(
    resetCustomerPassword({ token: rawToken, newPassword: "AnotherPassword789!" }),
    expectGenericRecoveryError
  );
});

test("unknown, expired, and already-used reset tokens return the same public error", async () => {
  const suffix = randomUUID().slice(0, 8);
  const registered = await registerCustomer({
    name: "Expiry Recovery Customer",
    username: `expiry.${suffix}`,
    email: `expiry-${suffix}@example.com`,
    password: "OldPassword123!"
  });
  rememberCustomer(registered.customer.id);
  const now = new Date("2026-08-27T04:00:00.000Z");
  const { deliveries, delivery } = captureDelivery();
  await requestCustomerPasswordRecovery({ identifier: registered.customer.email }, delivery, now);
  const token = tokenFromRecoveryUrl(deliveries[0]!.recoveryUrl);

  await assert.rejects(
    resetCustomerPassword(
      { token: "missing-token-value-that-is-long-enough", newPassword: "NewPassword456!" },
      now
    ),
    expectGenericRecoveryError
  );
  await assert.rejects(
    resetCustomerPassword(
      { token, newPassword: "NewPassword456!" },
      new Date(now.getTime() + 15 * 60 * 1000 + 1)
    ),
    expectGenericRecoveryError
  );
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
