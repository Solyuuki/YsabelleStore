import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { env } from "../src/config/env.js";
import { prisma } from "../src/database/prismaClient.js";
import {
  requestCustomerPasswordRecovery,
  resetCustomerPassword,
  verifyCustomerPasswordRecoveryCode,
  type CustomerRecoveryEmailDelivery
} from "../src/services/customerPasswordRecoveryService.js";
import {
  createCustomerSession,
  hashCustomerSessionToken,
  loginCustomer,
  registerCustomer
} from "../src/services/customerAuthService.js";
import {
  CUSTOMER_RECOVERY_OTP_LIFETIME_MS,
  customerRecoveryOtpMatches
} from "../src/utils/customerRecoveryOtp.js";
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
  const deliveries: Array<{ to: string; verificationCode: string; expiresAt: Date }> = [];
  const delivery: CustomerRecoveryEmailDelivery = {
    async sendPasswordRecoveryEmail(input) {
      deliveries.push(input);
    }
  };
  return { deliveries, delivery };
}

function expectGenericCodeError(error: unknown) {
  assert.ok(error instanceof HttpError);
  assert.equal(error.statusCode, 400);
  assert.equal(error.code, "CUSTOMER_PASSWORD_RECOVERY_CODE_INVALID");
  assert.equal(error.message, "The verification code is invalid or expired. Request a new code.");
  return true;
}

function expectGenericGrantError(error: unknown) {
  assert.ok(error instanceof HttpError);
  assert.equal(error.statusCode, 400);
  assert.equal(error.code, "CUSTOMER_PASSWORD_RECOVERY_INVALID");
  assert.equal(error.message, "This recovery session is invalid or expired. Request a new code.");
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
    assert.match(deliveries[0]?.verificationCode ?? "", /^\d{6}$/);
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

test("recovery OTP is stored only as a keyed hash and expires exactly ten minutes after creation", async () => {
  const suffix = randomUUID().slice(0, 8);
  const registered = await registerCustomer({
    name: "OTP Recovery Customer",
    username: `otp.recovery.${suffix}`,
    email: `otp-recovery-${suffix}@example.com`,
    password: "OldPassword123!"
  });
  rememberCustomer(registered.customer.id);
  const now = new Date("2026-08-27T04:00:00.000Z");
  const { deliveries, delivery } = captureDelivery();

  await requestCustomerPasswordRecovery({ identifier: registered.customer.email }, delivery, now);
  const code = deliveries[0]!.verificationCode;
  const persisted = await prisma.customerPasswordResetToken.findFirstOrThrow({
    where: {
      customerAccountId: registered.customer.id,
      id: { startsWith: "otp:" },
      usedAt: null
    }
  });

  assert.notEqual(persisted.tokenHash, code);
  assert.equal(persisted.tokenHash.length, 64);
  assert.equal(persisted.expiresAt.getTime(), now.getTime() + CUSTOMER_RECOVERY_OTP_LIFETIME_MS);
  assert.equal(persisted.usedAt, null);
  assert.ok(env.JWT_SECRET);
  assert.equal(customerRecoveryOtpMatches(env.JWT_SECRET, persisted.id, code, persisted.tokenHash), true);
});

test("a newer recovery request invalidates an older unused OTP", async () => {
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
  const firstCode = deliveries[0]!.verificationCode;
  await requestCustomerPasswordRecovery({ identifier: registered.customer.email }, delivery);

  await assert.rejects(
    verifyCustomerPasswordRecoveryCode({
      identifier: registered.customer.email,
      verificationCode: firstCode
    }),
    expectGenericCodeError
  );
});

test("delivery failure removes the newly issued OTP challenge", async () => {
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
      where: { customerAccountId: registered.customer.id, usedAt: null }
    }),
    0
  );
});

test("five wrong verification codes permanently lock the current OTP challenge", async () => {
  const suffix = randomUUID().slice(0, 8);
  const registered = await registerCustomer({
    name: "Attempt Limited Customer",
    username: `attempt.limit.${suffix}`,
    email: `attempt-limit-${suffix}@example.com`,
    password: "OldPassword123!"
  });
  rememberCustomer(registered.customer.id);
  const { deliveries, delivery } = captureDelivery();

  await requestCustomerPasswordRecovery({ identifier: registered.customer.email }, delivery);
  const correctCode = deliveries[0]!.verificationCode;
  const wrongCode = correctCode === "000000" ? "000001" : "000000";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    await assert.rejects(
      verifyCustomerPasswordRecoveryCode({
        identifier: registered.customer.email,
        verificationCode: wrongCode
      }),
      expectGenericCodeError
    );
  }

  const markers = await prisma.customerPasswordResetToken.count({
    where: {
      customerAccountId: registered.customer.id,
      id: { startsWith: "otp-attempt:otp:" }
    }
  });
  assert.equal(markers, 5);

  await assert.rejects(
    verifyCustomerPasswordRecoveryCode({
      identifier: registered.customer.email,
      verificationCode: correctCode
    }),
    expectGenericCodeError
  );
});

test("successful OTP verification creates one recovery grant; reset changes password and revokes every active session", async () => {
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
  const grant = await verifyCustomerPasswordRecoveryCode({
    identifier: registered.customer.email,
    verificationCode: deliveries[0]!.verificationCode
  });
  assert.ok(grant.recoveryGrant.length >= 43);

  await resetCustomerPassword({ recoveryGrant: grant.recoveryGrant, newPassword });

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
    resetCustomerPassword({
      recoveryGrant: grant.recoveryGrant,
      newPassword: "AnotherPassword789!"
    }),
    expectGenericGrantError
  );
});

test("expired codes and unknown recovery grants use generic errors", async () => {
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

  await assert.rejects(
    verifyCustomerPasswordRecoveryCode(
      {
        identifier: registered.customer.email,
        verificationCode: deliveries[0]!.verificationCode
      },
      new Date(now.getTime() + CUSTOMER_RECOVERY_OTP_LIFETIME_MS + 1)
    ),
    expectGenericCodeError
  );

  await assert.rejects(
    resetCustomerPassword({
      recoveryGrant: "unknown-recovery-grant-value-that-is-long-enough-123456",
      newPassword: "NewPassword456!"
    }),
    expectGenericGrantError
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
