import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import { loginCustomer } from "../src/services/customerAuthService.js";
import {
  hashPassword,
  hashPasswordWithProfileForTest,
  passwordHashNeedsUpgrade,
  verifyPassword
} from "../src/services/passwordHashService.js";
import { HttpError } from "../src/utils/httpError.js";

const createdCustomerIds: string[] = [];

function expectInvalidCredentials(error: unknown) {
  assert.ok(error instanceof HttpError);
  assert.equal(error.statusCode, 401);
  assert.equal(error.code, "INVALID_CUSTOMER_CREDENTIALS");
  assert.equal(error.message, "Invalid credentials.");
  return true;
}

test("legacy customer password hashes remain verifiable and are marked for upgrade", async () => {
  const password = "CustomerPass123!";
  const legacy = await hashPasswordWithProfileForTest(password, "legacy");

  assert.equal(await verifyPassword(password, legacy), true);
  assert.equal(passwordHashNeedsUpgrade(legacy), true);
});

test("new customer password hashes use the current profile", async () => {
  const password = "CustomerPass123!";
  const current = await hashPassword(password);

  assert.equal(await verifyPassword(password, current), true);
  assert.equal(passwordHashNeedsUpgrade(current), false);
  assert.match(current, /^scrypt\$65536\$8\$1\$/);
});

test("successful customer login upgrades a legacy password hash before creating the new session", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `password-upgrade-${suffix}@example.com`;
  const password = "CustomerPass123!";
  const legacyHash = await hashPasswordWithProfileForTest(password, "legacy");
  const customer = await prisma.customerAccount.create({
    data: {
      name: "Password Upgrade Customer",
      email,
      passwordHash: legacyHash,
      status: "ACTIVE"
    }
  });
  createdCustomerIds.push(customer.id);

  const session = await loginCustomer({ email, password });
  assert.equal(session.customer.id, customer.id);

  const persisted = await prisma.customerAccount.findUniqueOrThrow({ where: { id: customer.id } });
  assert.equal(passwordHashNeedsUpgrade(persisted.passwordHash), false);
  assert.notEqual(persisted.passwordHash, legacyHash);
});

test("missing and inactive customer login use the same public credential failure as a wrong password", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `inactive-password-${suffix}@example.com`;
  const password = "CustomerPass123!";
  const customer = await prisma.customerAccount.create({
    data: {
      name: "Inactive Password Customer",
      email,
      passwordHash: await hashPassword(password),
      status: "INACTIVE"
    }
  });
  createdCustomerIds.push(customer.id);

  await assert.rejects(
    loginCustomer({ email: `missing-${suffix}@example.com`, password }),
    expectInvalidCredentials
  );
  await assert.rejects(loginCustomer({ email, password }), expectInvalidCredentials);

  await prisma.customerAccount.update({ data: { status: "ACTIVE" }, where: { id: customer.id } });
  await assert.rejects(
    loginCustomer({ email, password: "DefinitelyWrong123!" }),
    expectInvalidCredentials
  );
});

test.after(async () => {
  await prisma.customerSession.deleteMany({
    where: { customerAccountId: { in: createdCustomerIds } }
  });
  await prisma.customerAccount.deleteMany({
    where: { id: { in: createdCustomerIds } }
  });
});
