import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import {
  createCustomerSession,
  getCustomerFromSessionToken,
  loginCustomer,
  registerCustomer,
  revokeCustomerSession
} from "../src/services/customerAuthService.js";
import { HttpError } from "../src/utils/httpError.js";

const createdCustomerIds: string[] = [];

function rememberCustomer(customerId: string) {
  createdCustomerIds.push(customerId);
  return customerId;
}

function expectHttpError(
  error: unknown,
  expected: { code: string; message: string; status: number }
) {
  assert.ok(error instanceof HttpError);
  assert.equal(error.statusCode, expected.status);
  assert.equal(error.code, expected.code);
  assert.equal(error.message, expected.message);
  return true;
}

test("customer account and finite session persist independently from internal users", async () => {
  const suffix = randomUUID().slice(0, 8);
  const customer = await prisma.customerAccount.create({
    data: {
      name: "Customer Auth Test",
      email: `customer-auth-${suffix}@example.com`,
      phone: "09171234567",
      passwordHash: "scrypt$test-placeholder",
      status: "ACTIVE"
    }
  });
  rememberCustomer(customer.id);

  const expiresAt = new Date(Date.now() + 60_000);
  const session = await prisma.customerSession.create({
    data: {
      customerAccountId: customer.id,
      tokenHash: createHash("sha256").update(randomUUID()).digest("hex"),
      expiresAt
    }
  });

  assert.equal(session.customerAccountId, customer.id);
  assert.equal(session.revokedAt, null);
  assert.equal(session.expiresAt.getTime(), expiresAt.getTime());
});

test("registration normalizes identity, hashes the password, and returns only safe customer data", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `customer-${suffix}@example.com`;
  const registered = await registerCustomer({
    name: "  Maria Customer  ",
    username: `Maria.${suffix.toUpperCase()}`,
    email: `  ${email.toUpperCase()}  `,
    phone: " 09171234567 ",
    password: "CustomerPass123!"
  });
  rememberCustomer(registered.customer.id);

  const persisted = await prisma.customerAccount.findUniqueOrThrow({
    where: { id: registered.customer.id }
  });

  assert.equal(registered.customer.name, "Maria Customer");
  assert.equal(registered.customer.username, `maria.${suffix}`);
  assert.equal(registered.customer.email, email);
  assert.equal(registered.customer.phone, "+639171234567");
  assert.equal("passwordHash" in registered.customer, false);
  assert.equal(persisted.email, email);
  assert.equal(persisted.phoneNormalized, "+639171234567");
  assert.ok(persisted.passwordHash.startsWith("scrypt$"));
  assert.notEqual(persisted.passwordHash, "CustomerPass123!");
  assert.ok(registered.sessionToken.length >= 32);
  assert.ok(registered.expiresAt.getTime() > Date.now());

  const storedSession = await prisma.customerSession.findFirstOrThrow({
    where: { customerAccountId: registered.customer.id }
  });
  assert.equal(storedSession.tokenHash.length, 64);
  assert.notEqual(storedSession.tokenHash, registered.sessionToken);
});

test("registration rejects an already registered email after normalization with a generic conflict", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `duplicate-${suffix}@example.com`;
  const first = await registerCustomer({
    name: "First Customer",
    username: `duplicate.first.${suffix}`,
    email,
    password: "CustomerPass123!"
  });
  rememberCustomer(first.customer.id);

  await assert.rejects(
    registerCustomer({
      name: "Second Customer",
      username: `duplicate.second.${suffix}`,
      email: ` ${email.toUpperCase()} `,
      password: "CustomerPass456!"
    }),
    (error) =>
      expectHttpError(error, {
        status: 409,
        code: "CUSTOMER_ACCOUNT_CONFLICT",
        message: "Unable to create customer account with the supplied details."
      })
  );
});

test("missing customer and wrong password return the same public credential error", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `login-${suffix}@example.com`;
  const registered = await registerCustomer({
    name: "Login Customer",
    username: `login.${suffix}`,
    email,
    password: "CustomerPass123!"
  });
  rememberCustomer(registered.customer.id);

  const expected = {
    status: 401,
    code: "INVALID_CUSTOMER_CREDENTIALS",
    message: "Invalid credentials."
  };

  await assert.rejects(
    loginCustomer({
      identifier: `missing-${suffix}@example.com`,
      password: "CustomerPass123!"
    }),
    (error) => expectHttpError(error, expected)
  );
  await assert.rejects(
    loginCustomer({ identifier: email, password: "DefinitelyWrong123!" }),
    (error) => expectHttpError(error, expected)
  );
});

test("inactive customer cannot log in and active customer receives a new finite session", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `inactive-${suffix}@example.com`;
  const registered = await registerCustomer({
    name: "Inactive Customer",
    username: `inactive.${suffix}`,
    email,
    password: "CustomerPass123!"
  });
  rememberCustomer(registered.customer.id);

  await prisma.customerAccount.update({
    data: { status: "INACTIVE" },
    where: { id: registered.customer.id }
  });

  await assert.rejects(
    loginCustomer({ identifier: email, password: "CustomerPass123!" }),
    (error) =>
      expectHttpError(error, {
        status: 401,
        code: "INVALID_CUSTOMER_CREDENTIALS",
        message: "Invalid credentials."
      })
  );

  await prisma.customerAccount.update({
    data: { status: "ACTIVE" },
    where: { id: registered.customer.id }
  });
  const session = await loginCustomer({
    identifier: email.toUpperCase(),
    password: "CustomerPass123!"
  });
  assert.equal(session.customer.id, registered.customer.id);
  assert.ok(session.expiresAt.getTime() > Date.now());
});

test("expired, revoked, and inactive-account sessions are rejected", async () => {
  const suffix = randomUUID().slice(0, 8);
  const customer = await prisma.customerAccount.create({
    data: {
      name: "Session Customer",
      email: `session-${suffix}@example.com`,
      passwordHash: "scrypt$test-placeholder",
      status: "ACTIVE"
    }
  });
  rememberCustomer(customer.id);

  const now = new Date("2026-08-22T12:00:00.000Z");
  const expired = await createCustomerSession(
    customer.id,
    new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000)
  );
  await assert.rejects(getCustomerFromSessionToken(expired.sessionToken, now), (error) =>
    expectHttpError(error, {
      status: 401,
      code: "CUSTOMER_SESSION_INVALID",
      message: "Customer session is invalid or expired."
    })
  );

  const revoked = await createCustomerSession(customer.id, now);
  await revokeCustomerSession(revoked.sessionToken);
  await assert.rejects(getCustomerFromSessionToken(revoked.sessionToken, now), (error) =>
    expectHttpError(error, {
      status: 401,
      code: "CUSTOMER_SESSION_INVALID",
      message: "Customer session is invalid or expired."
    })
  );

  const inactive = await createCustomerSession(customer.id, now);
  await prisma.customerAccount.update({ data: { status: "INACTIVE" }, where: { id: customer.id } });
  await assert.rejects(getCustomerFromSessionToken(inactive.sessionToken, now), (error) =>
    expectHttpError(error, {
      status: 401,
      code: "CUSTOMER_SESSION_INVALID",
      message: "Customer session is invalid or expired."
    })
  );
});

test("valid session resolves safe customer identity and updates last-used timestamp", async () => {
  const suffix = randomUUID().slice(0, 8);
  const customer = await prisma.customerAccount.create({
    data: {
      name: "Active Session Customer",
      email: `active-session-${suffix}@example.com`,
      passwordHash: "scrypt$test-placeholder",
      status: "ACTIVE"
    }
  });
  rememberCustomer(customer.id);

  const issuedAt = new Date("2026-08-22T12:00:00.000Z");
  const usedAt = new Date("2026-08-22T12:05:00.000Z");
  const session = await createCustomerSession(customer.id, issuedAt);
  const resolved = await getCustomerFromSessionToken(session.sessionToken, usedAt);

  assert.equal(resolved.id, customer.id);
  assert.equal(resolved.email, customer.email);
  assert.equal(resolved.username, null);
  assert.equal("passwordHash" in resolved, false);

  const persisted = await prisma.customerSession.findUniqueOrThrow({
    where: { tokenHash: createHash("sha256").update(session.sessionToken).digest("hex") }
  });
  assert.equal(persisted.lastUsedAt?.getTime(), usedAt.getTime());
});

test.after(async () => {
  await prisma.customerSession.deleteMany({
    where: { customerAccountId: { in: createdCustomerIds } }
  });
  await prisma.customerAccount.deleteMany({
    where: { id: { in: createdCustomerIds } }
  });
});
