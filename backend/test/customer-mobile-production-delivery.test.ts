import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import { requestCustomerMobileRegistrationVerification } from "../src/services/customerMobileRegistrationService.js";
import { normalizePhilippineMobile } from "../src/utils/customerIdentity.js";

test("production mobile auth paths use the shared SMS adapter and never log usable OTP codes", () => {
  const mobileAuthSource = readFileSync(
    resolve(process.cwd(), "backend/src/services/customerMobileAuthService.ts"),
    "utf8"
  );
  const mobileRegistrationSource = readFileSync(
    resolve(process.cwd(), "backend/src/services/customerMobileRegistrationService.ts"),
    "utf8"
  );

  for (const source of [mobileAuthSource, mobileRegistrationSource]) {
    assert.match(source, /customerMobileSmsDelivery/);
    assert.doesNotMatch(source, /customer_mobile_(?:auth|registration)_dev_otp/);
    assert.doesNotMatch(source, /console\.info/);
  }
});

test("mobile registration resend cooldown prevents duplicate SMS delivery and challenge rotation", async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
  const phone = normalizePhilippineMobile(
    `0918${(Number.parseInt(suffix.slice(0, 7), 16) % 10_000_000)
      .toString()
      .padStart(7, "0")}`
  );
  assert.ok(phone);

  const registrationIntentToken = `phase7-intent-${randomUUID()}`;
  const now = new Date();
  let deliveries = 0;
  const delivery = async () => {
    deliveries += 1;
  };

  try {
    await requestCustomerMobileRegistrationVerification(
      { phone, registrationIntentToken },
      delivery,
      now
    );
    const firstChallenge = await prisma.customerMobileRegistrationChallenge.findFirst({
      where: { phoneNormalized: phone, consumedAt: null },
      orderBy: { createdAt: "desc" }
    });
    assert.ok(firstChallenge);

    await requestCustomerMobileRegistrationVerification(
      { phone, registrationIntentToken },
      delivery,
      new Date(now.getTime() + 10_000)
    );
    const secondChallenge = await prisma.customerMobileRegistrationChallenge.findFirst({
      where: { phoneNormalized: phone, consumedAt: null },
      orderBy: { createdAt: "desc" }
    });

    assert.equal(deliveries, 1);
    assert.equal(secondChallenge?.id, firstChallenge.id);
  } finally {
    await prisma.customerMobileRegistrationChallenge.deleteMany({
      where: { phoneNormalized: phone }
    });
  }
});
