import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import {
  requestCustomerSessionRevokeVerification,
  revokeOtherCustomerSessions,
  verifyCustomerSessionRevokeCode,
  type CustomerSessionRevokeDelivery
} from "../src/services/customerAccountService.js";
import {
  createCustomerSession,
  hashCustomerSessionToken
} from "../src/services/customerAuthService.js";

const createdCustomerIds: string[] = [];

function captureDelivery() {
  const deliveries: Array<{ to: string; verificationCode: string; expiresAt: Date }> = [];
  const delivery: CustomerSessionRevokeDelivery = {
    async sendSessionRevokeEmail(input) {
      deliveries.push(input);
    }
  };
  return { deliveries, delivery };
}

test("passwordless customer can verify by email and revoke only other sessions", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `session-step-up-${suffix}@example.com`;
  const customer = await prisma.customerAccount.create({
    data: {
      name: "Session Step Up Customer",
      email,
      passwordHash: null,
      status: "ACTIVE"
    }
  });
  createdCustomerIds.push(customer.id);

  const currentSession = await createCustomerSession(customer.id);
  const otherSession = await createCustomerSession(customer.id);

  const { deliveries, delivery } = captureDelivery();
  await requestCustomerSessionRevokeVerification(customer.id, delivery);

  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0]?.to, email);
  assert.match(deliveries[0]?.verificationCode ?? "", /^\d{6}$/);

  const grant = await verifyCustomerSessionRevokeCode(customer.id, deliveries[0]!.verificationCode);
  assert.ok(grant.sessionRevokeGrant.length >= 32);

  const revokedCount = await revokeOtherCustomerSessions(
    customer.id,
    currentSession.sessionToken,
    {},
    grant.sessionRevokeGrant
  );
  assert.equal(revokedCount, 1);

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

  await assert.rejects(
    revokeOtherCustomerSessions(
      customer.id,
      currentSession.sessionToken,
      {},
      grant.sessionRevokeGrant
    )
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
