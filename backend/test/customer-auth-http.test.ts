import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import { createApp } from "../src/app.js";
import { prisma } from "../src/database/prismaClient.js";
import { registerLocalUser } from "../src/services/authService.js";

const CUSTOMER_COOKIE_NAME = "ysabelle_customer_session";
const PASSWORD = "CustomerPass123!";

type ApiBody = {
  success?: boolean;
  message?: string;
  data?: {
    customer?: {
      id?: string;
      name?: string;
      username?: string | null;
      email?: string;
      phone?: string | null;
      status?: string;
    };
  };
  error?: {
    code?: string;
  };
};

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
  return setCookie.split(";", 1)[0]!;
}

async function json(response: Response): Promise<ApiBody> {
  return (await response.json()) as ApiBody;
}

async function issueRegistrationIntent(baseUrl: string) {
  const intent = await fetch(`${baseUrl}/api/customer-auth/registration-intent`);
  assert.equal(intent.status, 200);

  const cookie = cookiePair(intent.headers.get("set-cookie") ?? "");
  assert.match(cookie, /^ysabelle_customer_registration_intent=/);
  await new Promise((resolve) => setTimeout(resolve, 800));
  return cookie;
}

async function registerCustomerHttp(
  baseUrl: string,
  input: {
    name: string;
    username: string;
    email: string;
    password: string;
    phone?: string;
  }
) {
  const registrationIntentCookie = await issueRegistrationIntent(baseUrl);
  return fetch(`${baseUrl}/api/customer-auth/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Cookie: registrationIntentCookie
    },
    body: JSON.stringify(input)
  });
}

async function cleanupCustomer(email: string) {
  const customer = await prisma.customerAccount.findUnique({ where: { email } });
  if (!customer) return;

  await prisma.customerSession.deleteMany({ where: { customerAccountId: customer.id } });
  await prisma.customerAccount.delete({ where: { id: customer.id } });
}

test("customer register, session restore, and logout use a revocable HttpOnly cookie without exposing the raw token", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `http-${suffix}@example.com`;
  const username = `http.${suffix}`;

  try {
    await withServer(async (baseUrl) => {
      const register = await registerCustomerHttp(baseUrl, {
        name: "HTTP Customer",
        username,
        email: `  ${email.toUpperCase()}  `,
        password: PASSWORD
      });

      assert.equal(register.status, 201);
      const setCookie = register.headers.get("set-cookie") ?? "";
      assert.match(setCookie, new RegExp(`^${CUSTOMER_COOKIE_NAME}=`));
      assert.match(setCookie, /HttpOnly/i);
      assert.match(setCookie, /SameSite=Lax/i);
      assert.match(setCookie, /Path=\/api/i);
      assert.match(setCookie, /Max-Age=604800/i);
      assert.doesNotMatch(setCookie, /Secure/i);

      const registerBody = await json(register);
      assert.equal(registerBody.data?.customer?.username, username);
      assert.equal(registerBody.data?.customer?.email, email);
      assert.equal(registerBody.data?.customer?.phone, null);
      assert.equal(JSON.stringify(registerBody).includes("sessionToken"), false);
      assert.equal(JSON.stringify(registerBody).includes("phoneNormalized"), false);

      const cookie = cookiePair(setCookie);
      const me = await fetch(`${baseUrl}/api/customer-auth/me`, {
        headers: { Cookie: cookie }
      });
      assert.equal(me.status, 200);
      const meBody = await json(me);
      assert.equal(meBody.data?.customer?.username, username);
      assert.equal(meBody.data?.customer?.email, email);
      assert.equal(JSON.stringify(meBody).includes("sessionToken"), false);
      assert.equal(JSON.stringify(meBody).includes("phoneNormalized"), false);

      const logout = await fetch(`${baseUrl}/api/customer-auth/logout`, {
        method: "POST",
        headers: { Cookie: cookie }
      });
      assert.equal(logout.status, 200);
      const clearedCookie = logout.headers.get("set-cookie") ?? "";
      assert.match(clearedCookie, new RegExp(`^${CUSTOMER_COOKIE_NAME}=`));
      assert.match(clearedCookie, /Max-Age=0/i);
      assert.match(clearedCookie, /HttpOnly/i);
      assert.match(clearedCookie, /SameSite=Lax/i);
      assert.match(clearedCookie, /Path=\/api/i);

      const revoked = await fetch(`${baseUrl}/api/customer-auth/me`, {
        headers: { Cookie: cookie }
      });
      assert.equal(revoked.status, 401);
    });
  } finally {
    await cleanupCustomer(email);
  }
});

test("customer login keeps credential failures generic and registration rejects normalized duplicate email", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `generic-${suffix}@example.com`;

  try {
    await withServer(async (baseUrl) => {
      const register = await registerCustomerHttp(baseUrl, {
        name: "Generic Customer",
        username: `generic.${suffix}`,
        email,
        password: PASSWORD
      });
      assert.equal(register.status, 201);

      const duplicate = await registerCustomerHttp(baseUrl, {
        name: "Duplicate Customer",
        username: `generic.duplicate.${suffix}`,
        email: ` ${email.toUpperCase()} `,
        password: PASSWORD
      });
      assert.equal(duplicate.status, 409);

      const wrongPassword = await fetch(`${baseUrl}/api/customer-auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier: email, password: "wrong-password" })
      });
      const missingAccount = await fetch(`${baseUrl}/api/customer-auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identifier: `missing-${suffix}@example.com`,
          password: "wrong-password"
        })
      });

      assert.equal(wrongPassword.status, 401);
      assert.equal(missingAccount.status, 401);
      const wrongBody = await json(wrongPassword);
      const missingBody = await json(missingAccount);
      assert.equal(wrongBody.message, missingBody.message);
      assert.equal(wrongBody.error?.code, missingBody.error?.code);
      assert.equal(wrongBody.error?.code, "INVALID_CUSTOMER_CREDENTIALS");
    });
  } finally {
    await cleanupCustomer(email);
  }
});

test("customer auth supports credentialed CORS only for approved concrete origins", async () => {
  await withServer(async (baseUrl) => {
    const allowed = await fetch(`${baseUrl}/api/customer-auth/me`, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "GET"
      }
    });

    assert.equal(allowed.headers.get("access-control-allow-origin"), "http://localhost:5173");
    assert.equal(allowed.headers.get("access-control-allow-credentials"), "true");
    assert.notEqual(allowed.headers.get("access-control-allow-origin"), "*");

    const rejected = await fetch(`${baseUrl}/api/customer-auth/me`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://untrusted.example",
        "Access-Control-Request-Method": "GET"
      }
    });

    assert.equal(rejected.headers.get("access-control-allow-origin"), null);
  });
});

test("customer cookie and internal bearer authentication remain isolated", async () => {
  const suffix = randomUUID().slice(0, 8);
  const customerEmail = `boundary-customer-${suffix}@example.com`;
  const internalEmail = `boundary-staff-${suffix}@example.com`;

  try {
    const internal = await registerLocalUser({
      name: "Boundary Staff",
      email: internalEmail,
      password: PASSWORD,
      role: "STAFF"
    });

    await withServer(async (baseUrl) => {
      const register = await registerCustomerHttp(baseUrl, {
        name: "Boundary Customer",
        username: `boundary.${suffix}`,
        email: customerEmail,
        password: PASSWORD
      });
      assert.equal(register.status, 201);
      const customerCookie = cookiePair(register.headers.get("set-cookie") ?? "");

      const internalMeWithCustomerCookie = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Cookie: customerCookie }
      });
      assert.equal(internalMeWithCustomerCookie.status, 401);

      const customerMeWithInternalBearer = await fetch(`${baseUrl}/api/customer-auth/me`, {
        headers: { Authorization: `Bearer ${internal.token}` }
      });
      assert.equal(customerMeWithInternalBearer.status, 401);
    });
  } finally {
    await cleanupCustomer(customerEmail);
    await prisma.trustedDevice.deleteMany({ where: { user: { email: internalEmail } } });
    await prisma.user.deleteMany({ where: { email: internalEmail } });
  }
});
