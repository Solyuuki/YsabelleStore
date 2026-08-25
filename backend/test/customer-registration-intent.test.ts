import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createApp } from "../src/app.js";
import { prisma } from "../src/database/prismaClient.js";

const REGISTRATION_INTENT_COOKIE_NAME = "ysabelle_customer_registration_intent";
const PASSWORD = "CustomerPass123!";

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

function cookiePair(setCookie: string) {
  return setCookie.split(";", 1)[0] ?? "";
}

async function waitForIntentMinimumAge() {
  await new Promise((resolve) => setTimeout(resolve, 800));
}

async function issueIntent(baseUrl: string) {
  const response = await fetch(`${baseUrl}/api/customer-auth/registration-intent`);
  const body = (await response.json()) as {
    success?: boolean;
    data?: { ready?: boolean };
  };
  return { response, body };
}

function usernameFromEmail(email: string) {
  return email
    .split("@", 1)[0]!
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, ".")
    .slice(0, 30);
}

async function register(baseUrl: string, email: string, cookie?: string) {
  return fetch(`${baseUrl}/api/customer-auth/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: JSON.stringify({
      name: "Intent Guard Customer",
      username: usernameFromEmail(email),
      email,
      password: PASSWORD
    })
  });
}

async function cleanupCustomer(email: string) {
  const customer = await prisma.customerAccount.findUnique({ where: { email } });
  if (!customer) return;

  await prisma.customerSession.deleteMany({ where: { customerAccountId: customer.id } });
  await prisma.customerAccount.delete({ where: { id: customer.id } });
}

test("customer registration rejects a direct POST without a registration intent", async () => {
  const email = `registration-intent-${randomUUID().slice(0, 8)}@example.com`;

  try {
    await withServer(async (baseUrl) => {
      const response = await register(baseUrl, email);
      const body = (await response.json()) as {
        success?: boolean;
        error?: { code?: string };
      };

      assert.equal(response.status, 403);
      assert.equal(body.success, false);
      assert.equal(body.error?.code, "CUSTOMER_REGISTRATION_INTENT_REQUIRED");
    });
  } finally {
    await cleanupCustomer(email);
  }
});

test("registration intent endpoint issues a short-lived HttpOnly cookie", async () => {
  await withServer(async (baseUrl) => {
    const { response, body } = await issueIntent(baseUrl);

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data?.ready, true);

    const setCookie = response.headers.get("set-cookie") ?? "";
    assert.match(setCookie, new RegExp(`^${REGISTRATION_INTENT_COOKIE_NAME}=`));
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    assert.match(setCookie, /Path=\/api\/customer-auth/i);
    assert.match(setCookie, /Max-Age=600/i);
    assert.doesNotMatch(setCookie, /Secure/i);
  });
});

test("registration intent that is too new is rejected", async () => {
  const email = `registration-too-fast-${randomUUID().slice(0, 8)}@example.com`;

  try {
    await withServer(async (baseUrl) => {
      const { response: intentResponse } = await issueIntent(baseUrl);
      const cookie = cookiePair(intentResponse.headers.get("set-cookie") ?? "");
      const response = await register(baseUrl, email, cookie);
      const body = (await response.json()) as {
        success?: boolean;
        error?: { code?: string };
      };

      assert.equal(response.status, 403);
      assert.equal(body.error?.code, "CUSTOMER_REGISTRATION_INTENT_INVALID");
    });
  } finally {
    await cleanupCustomer(email);
  }
});

test("tampered registration intent is rejected", async () => {
  const email = `registration-tampered-${randomUUID().slice(0, 8)}@example.com`;

  try {
    await withServer(async (baseUrl) => {
      const { response: intentResponse } = await issueIntent(baseUrl);
      const cookie = cookiePair(intentResponse.headers.get("set-cookie") ?? "");
      await waitForIntentMinimumAge();

      const [name, value = ""] = cookie.split("=", 2);
      const finalCharacter = value.at(-1) === "a" ? "b" : "a";
      const tamperedCookie = `${name}=${value.slice(0, -1)}${finalCharacter}`;
      const response = await register(baseUrl, email, tamperedCookie);
      const body = (await response.json()) as {
        success?: boolean;
        error?: { code?: string };
      };

      assert.equal(response.status, 403);
      assert.equal(body.error?.code, "CUSTOMER_REGISTRATION_INTENT_INVALID");
    });
  } finally {
    await cleanupCustomer(email);
  }
});

test("valid registration intent allows normal customer registration", async () => {
  const email = `registration-valid-${randomUUID().slice(0, 8)}@example.com`;

  try {
    await withServer(async (baseUrl) => {
      const { response: intentResponse } = await issueIntent(baseUrl);
      const cookie = cookiePair(intentResponse.headers.get("set-cookie") ?? "");
      await waitForIntentMinimumAge();

      const response = await register(baseUrl, email, cookie);
      assert.equal(response.status, 201);

      const setCookie = response.headers.get("set-cookie") ?? "";
      assert.match(setCookie, /ysabelle_customer_session=/i);
      assert.match(setCookie, new RegExp(`${REGISTRATION_INTENT_COOKIE_NAME}=.*Max-Age=0`, "i"));
    });
  } finally {
    await cleanupCustomer(email);
  }
});
