import assert from "node:assert/strict";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";

test("customer accounts persist explicit email and mobile verification timestamps", async () => {
  const account = await prisma.customerAccount.findFirst({
    select: {
      emailVerifiedAt: true,
      phoneVerifiedAt: true
    }
  });

  assert.ok(account === null || "emailVerifiedAt" in account);
  assert.ok(account === null || "phoneVerifiedAt" in account);
});

test("registration email OTP uses its dedicated persisted challenge model", () => {
  assert.ok(prisma.customerEmailRegistrationChallenge);
});
