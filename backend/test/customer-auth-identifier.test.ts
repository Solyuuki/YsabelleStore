import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import { loginCustomer, registerCustomer } from "../src/services/customerAuthService.js";
import { hashPassword } from "../src/services/passwordHashService.js";
import { HttpError } from "../src/utils/httpError.js";
import {
  customerLoginSchema,
  customerRegisterSchema
} from "../src/validators/customerAuth.validators.js";

const PASSWORD = "CustomerPass123!";
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

function expectGenericConflict(error: unknown) {
  return expectHttpError(error, {
    status: 409,
    code: "CUSTOMER_ACCOUNT_CONFLICT",
    message: "Unable to create customer account with the supplied details."
  });
}

function expectInvalidCredentials(error: unknown) {
  return expectHttpError(error, {
    status: 401,
    code: "INVALID_CUSTOMER_CREDENTIALS",
    message: "Invalid credentials."
  });
}

test("new registration requires a valid username while login accepts one generic identifier field", () => {
  const missingUsername = customerRegisterSchema.safeParse({
    name: "No Username Customer",
    email: "no-username@example.com",
    password: PASSWORD
  });
  assert.equal(missingUsername.success, false);

  const validRegistration = customerRegisterSchema.safeParse({
    name: "Identifier Customer",
    username: "Maria.Santos",
    email: "maria@example.com",
    phone: "0917 123 4567",
    password: PASSWORD
  });
  assert.equal(validRegistration.success, true);
  if (validRegistration.success) {
    assert.equal(validRegistration.data.username, "maria.santos");
    assert.equal(validRegistration.data.phone, "+639171234567");
  }

  const validLogin = customerLoginSchema.safeParse({
    identifier: "Maria.Santos",
    password: PASSWORD
  });
  assert.equal(validLogin.success, true);
});

test("registration persists canonical username and Philippine mobile identity and returns only safe fields", async () => {
  const suffix = randomUUID().slice(0, 8);
  const registered = await registerCustomer({
    name: "  Maria Identifier  ",
    username: `Maria.${suffix}`,
    email: `  IDENTIFIER-${suffix}@EXAMPLE.COM  `,
    phone: "0917 321 4567",
    password: PASSWORD
  });
  rememberCustomer(registered.customer.id);

  const persisted = await prisma.customerAccount.findUniqueOrThrow({
    where: { id: registered.customer.id }
  });

  assert.equal(registered.customer.username, `maria.${suffix}`);
  assert.equal(registered.customer.email, `identifier-${suffix}@example.com`);
  assert.equal(registered.customer.phone, "+639173214567");
  assert.equal(persisted.username, `maria.${suffix}`);
  assert.equal(persisted.phone, "+639173214567");
  assert.equal(persisted.phoneNormalized, "+639173214567");

  assert.equal("phoneNormalized" in registered.customer, false);
  assert.equal("passwordHash" in registered.customer, false);
  assert.equal("tokenHash" in registered.customer, false);
  assert.equal("sessionToken" in registered.customer, false);
});

test("duplicate username, email, and equivalent mobile registrations use the same generic conflict", async () => {
  const suffix = randomUUID().slice(0, 8);
  const username = `duplicate.${suffix}`;
  const email = `duplicate-${suffix}@example.com`;

  const first = await registerCustomer({
    name: "First Duplicate Customer",
    username,
    email,
    phone: "09181234567",
    password: PASSWORD
  });
  rememberCustomer(first.customer.id);

  const duplicateInputs = [
    {
      name: "Duplicate Username Customer",
      username: username.toUpperCase(),
      email: `duplicate-username-${suffix}@example.com`,
      phone: "09191234567",
      password: PASSWORD
    },
    {
      name: "Duplicate Email Customer",
      username: `duplicate.email.${suffix}`,
      email: ` ${email.toUpperCase()} `,
      phone: "09201234567",
      password: PASSWORD
    },
    {
      name: "Duplicate Mobile Customer",
      username: `duplicate.mobile.${suffix}`,
      email: `duplicate-mobile-${suffix}@example.com`,
      phone: "+63 918 123 4567",
      password: PASSWORD
    }
  ];

  for (const input of duplicateInputs) {
    let caught: unknown;
    try {
      const unexpected = await registerCustomer(input);
      rememberCustomer(unexpected.customer.id);
    } catch (error) {
      caught = error;
    }

    assert.ok(caught, "expected duplicate registration to be rejected");
    expectGenericConflict(caught);
  }
});

test("concurrent registrations racing on the same username still expose only the generic conflict", async () => {
  const suffix = randomUUID().slice(0, 8);
  const username = `race.${suffix}`;

  const results = await Promise.allSettled([
    registerCustomer({
      name: "Username Race One",
      username,
      email: `race-one-${suffix}@example.com`,
      password: PASSWORD
    }),
    registerCustomer({
      name: "Username Race Two",
      username: username.toUpperCase(),
      email: `race-two-${suffix}@example.com`,
      password: PASSWORD
    })
  ]);

  for (const result of results) {
    if (result.status === "fulfilled") rememberCustomer(result.value.customer.id);
  }

  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  expectGenericConflict((rejected[0] as PromiseRejectedResult).reason);
});

test("one active customer can log in by username, email, and every supported equivalent PH mobile form", async () => {
  const suffix = randomUUID().slice(0, 8);
  const username = `login.${suffix}`;
  const email = `login-${suffix}@example.com`;
  const registered = await registerCustomer({
    name: "Multi Identifier Login",
    username,
    email,
    phone: "09981234567",
    password: PASSWORD
  });
  rememberCustomer(registered.customer.id);

  const identifiers = [
    username.toUpperCase(),
    email.toUpperCase(),
    "09981234567",
    "639981234567",
    "+639981234567"
  ];

  for (const identifier of identifiers) {
    const session = await loginCustomer({ identifier, password: PASSWORD });
    assert.equal(session.customer.id, registered.customer.id);
    assert.equal(session.customer.username, username);
  }
});

test("legacy username-null customer retains email login", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `legacy-${suffix}@example.com`;
  const customer = await prisma.customerAccount.create({
    data: {
      name: "Legacy Customer",
      username: null,
      email,
      phone: null,
      phoneNormalized: null,
      passwordHash: await hashPassword(PASSWORD),
      status: "ACTIVE"
    }
  });
  rememberCustomer(customer.id);

  const session = await loginCustomer({
    identifier: email.toUpperCase(),
    password: PASSWORD
  });

  assert.equal(session.customer.id, customer.id);
  assert.equal(session.customer.username, null);
});

test("malformed, nonexistent, inactive, and wrong-password identifiers all return the exact generic credential failure", async () => {
  const suffix = randomUUID().slice(0, 8);
  const registered = await registerCustomer({
    name: "Privacy Identifier Customer",
    username: `privacy.${suffix}`,
    email: `privacy-${suffix}@example.com`,
    phone: "09771234567",
    password: PASSWORD
  });
  rememberCustomer(registered.customer.id);

  const inactive = await prisma.customerAccount.create({
    data: {
      name: "Inactive Identifier Customer",
      username: `inactive.${suffix}`,
      email: `inactive-${suffix}@example.com`,
      phone: null,
      phoneNormalized: null,
      passwordHash: await hashPassword(PASSWORD),
      status: "INACTIVE"
    }
  });
  rememberCustomer(inactive.id);

  const attempts = [
    { identifier: "invalid@email", password: PASSWORD },
    { identifier: "+14155552671", password: PASSWORD },
    { identifier: `missing.${suffix}`, password: PASSWORD },
    { identifier: inactive.username!, password: PASSWORD },
    { identifier: registered.customer.username!, password: "DefinitelyWrong123!" }
  ];

  for (const attempt of attempts) {
    await assert.rejects(() => loginCustomer(attempt), expectInvalidCredentials);
  }
});

test.after(async () => {
  if (createdCustomerIds.length === 0) return;

  await prisma.customerSession.deleteMany({
    where: { customerAccountId: { in: createdCustomerIds } }
  });
  await prisma.customerAccount.deleteMany({
    where: { id: { in: createdCustomerIds } }
  });
});
