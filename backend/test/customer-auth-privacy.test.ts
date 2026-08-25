import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createApp } from "../src/app.js";
import { prisma } from "../src/database/prismaClient.js";
import { loginCustomer, registerCustomer } from "../src/services/customerAuthService.js";
import { HttpError } from "../src/utils/httpError.js";

const PASSWORD = "CustomerPass123!";
const GENERIC_CONFLICT = {
  code: "CUSTOMER_ACCOUNT_CONFLICT",
  message: "Unable to create customer account with the supplied details."
} as const;

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const app = createApp();
  const server = app.listen(0, "127.0.0.1");

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });

    const address = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function cleanupCustomer(email: string) {
  const customer = await prisma.customerAccount.findUnique({ where: { email } });
  if (!customer) return;

  await prisma.customerSession.deleteMany({ where: { customerAccountId: customer.id } });
  await prisma.customerAccount.delete({ where: { id: customer.id } });
}

function assertGenericConflict(error: unknown) {
  assert.ok(error instanceof HttpError);
  assert.equal(error.statusCode, 409);
  assert.equal(error.code, GENERIC_CONFLICT.code);
  assert.equal(error.message, GENERIC_CONFLICT.message);
  return true;
}

async function issueRegistrationIntent(baseUrl: string) {
  const response = await fetch(`${baseUrl}/api/customer-auth/registration-intent`);
  assert.equal(response.status, 200);

  const setCookie = response.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";", 1)[0] ?? "";
  assert.ok(cookie.startsWith("ysabelle_customer_registration_intent="));
  await new Promise((resolve) => setTimeout(resolve, 800));
  return cookie;
}

test("normalized duplicate registration uses a generic account-conflict response", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `privacy-duplicate-${suffix}@example.com`;

  try {
    await registerCustomer({
      name: "Privacy Customer",
      username: `privacy.first.${suffix}`,
      email,
      password: PASSWORD
    });

    await assert.rejects(
      () =>
        registerCustomer({
          name: "Duplicate Privacy Customer",
          username: `privacy.second.${suffix}`,
          email: `  ${email.toUpperCase()}  `,
          password: PASSWORD
        }),
      assertGenericConflict
    );
  } finally {
    await cleanupCustomer(email);
  }
});

test("concurrent registration conflict returns the same generic public error", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `privacy-race-${suffix}@example.com`;
  const input = {
    name: "Concurrent Privacy Customer",
    username: `privacy.race.${suffix}`,
    email,
    password: PASSWORD
  };

  try {
    const results = await Promise.allSettled([registerCustomer(input), registerCustomer(input)]);
    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assertGenericConflict((rejected[0] as PromiseRejectedResult).reason);
  } finally {
    await cleanupCustomer(email);
  }
});

test("customer login public failure remains exactly generic", async () => {
  const email = `privacy-missing-${randomUUID().slice(0, 8)}@example.com`;

  await assert.rejects(
    () => loginCustomer({ identifier: email, password: "WrongPassword123!" }),
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.statusCode, 401);
      assert.equal(error.code, "INVALID_CUSTOMER_CREDENTIALS");
      assert.equal(error.message, "Invalid credentials.");
      return true;
    }
  );
});

test("auth request audit logs remain metadata-only and never include submitted secrets", async () => {
  const email = `privacy-log-${randomUUID().slice(0, 8)}@example.com`;
  const password = "LogSecretPassword123!";
  const fakeSessionToken = `raw-session-${randomUUID()}`;
  const captured: string[] = [];
  const originalConsoleInfo = console.info;

  console.info = (...args: unknown[]) => {
    captured.push(args.map((value) => String(value)).join(" "));
  };

  try {
    await withServer(async (baseUrl) => {
      const login = await fetch(`${baseUrl}/api/customer-auth/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Cookie: `ysabelle_customer_session=${fakeSessionToken}`
        },
        body: JSON.stringify({ identifier: email, password })
      });
      assert.equal(login.status, 401);

      const me = await fetch(`${baseUrl}/api/customer-auth/me`, {
        headers: { Cookie: `ysabelle_customer_session=${fakeSessionToken}` }
      });
      assert.equal(me.status, 401);

      await new Promise<void>((resolve) => setImmediate(resolve));
    });
  } finally {
    console.info = originalConsoleInfo;
  }

  const logs = captured.join("\n");
  assert.doesNotMatch(logs, new RegExp(email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  assert.equal(logs.includes(password), false);
  assert.equal(logs.includes(fakeSessionToken), false);
  assert.equal(logs.includes("authorization"), false);
  assert.equal(logs.includes("cookie"), false);
});

test("customer auth JSON never exposes password or session persistence material", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `privacy-json-${suffix}@example.com`;

  try {
    await withServer(async (baseUrl) => {
      const intentCookie = await issueRegistrationIntent(baseUrl);
      const response = await fetch(`${baseUrl}/api/customer-auth/register`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Cookie: intentCookie
        },
        body: JSON.stringify({
          name: "Privacy JSON Customer",
          username: `privacy.json.${suffix}`,
          email,
          password: PASSWORD
        })
      });

      assert.equal(response.status, 201);
      const bodyText = await response.text();
      assert.equal(bodyText.includes(PASSWORD), false);
      assert.doesNotMatch(bodyText, /passwordHash|phoneNormalized|tokenHash|sessionToken/i);

      const sessionCookie = (response.headers.get("set-cookie") ?? "")
        .split(",")
        .map((value) => value.trim())
        .find((value) => value.startsWith("ysabelle_customer_session="))
        ?.split(";", 1)[0];
      assert.ok(sessionCookie);

      const me = await fetch(`${baseUrl}/api/customer-auth/me`, {
        headers: { Cookie: sessionCookie }
      });
      assert.equal(me.status, 200);
      const meBodyText = await me.text();
      assert.doesNotMatch(meBodyText, /passwordHash|phoneNormalized|tokenHash|sessionToken/i);
    });
  } finally {
    await cleanupCustomer(email);
  }
});
