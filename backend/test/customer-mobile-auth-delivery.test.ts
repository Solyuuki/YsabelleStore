import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import { registerCustomer } from "../src/services/customerAuthService.js";
import { requestCustomerMobileAuth } from "../src/services/customerMobileAuthService.js";
import { normalizePhilippineMobile } from "../src/utils/customerIdentity.js";

test("mobile OTP request delivers the generated six-digit code through the delivery adapter", async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
  const phone = `0917${(Number.parseInt(suffix.slice(0, 7), 16) % 10_000_000)
    .toString()
    .padStart(7, "0")}`;
  const phoneNormalized = normalizePhilippineMobile(phone);
  assert.ok(phoneNormalized);

  const registered = await registerCustomer({
    name: "Mobile OTP Delivery Customer",
    username: `otpdelivery.${suffix}`,
    email: `otpdelivery-${suffix}@example.com`,
    phone,
    password: "MobilePassword123!"
  });
  await prisma.customerAccount.update({
    where: { id: registered.customer.id },
    data: { phoneVerifiedAt: new Date() }
  });

  let deliveredCode = "";
  try {
    await requestCustomerMobileAuth(
      { phone: phoneNormalized },
      async ({ phone: deliveredPhone, verificationCode }) => {
        assert.equal(deliveredPhone, phoneNormalized);
        deliveredCode = verificationCode;
      }
    );

    assert.match(deliveredCode, /^\d{6}$/);
    const challenge = await prisma.customerMobileAuthChallenge.findFirst({
      where: { customerAccountId: registered.customer.id, consumedAt: null },
      orderBy: { createdAt: "desc" }
    });
    assert.ok(challenge);
    assert.equal(challenge.otpHash.includes(deliveredCode), false);
  } finally {
    await prisma.customerMobileAuthChallenge.deleteMany({
      where: { customerAccountId: registered.customer.id }
    });
    await prisma.customerSession.deleteMany({
      where: { customerAccountId: registered.customer.id }
    });
    await prisma.customerAccount.delete({ where: { id: registered.customer.id } });
  }
});
