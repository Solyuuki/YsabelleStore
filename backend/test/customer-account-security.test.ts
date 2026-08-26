import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import { createApp } from "../src/app.js";
import { prisma } from "../src/database/prismaClient.js";
import {
  hashPassword,
  passwordHashNeedsUpgrade,
  verifyPassword
} from "../src/services/passwordHashService.js";

const PASSWORD = "CustomerPass123!";
const NEW_PASSWORD = "CustomerPass456!";

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
    sessions?: Array<{
      id?: string;
      current?: boolean;
      createdAt?: string;
      lastUsedAt?: string | null;
      expiresAt?: string;
    }>;
    revokedCount?: number;
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

async function createCustomer(input: {
  name: string;
  username: string | null;
  email: string;
  password?: string;
}) {
  return prisma.customerAccount.create({
    data: {
      name: input.name,
      username: input.username,
      email: input.email,
      passwordHash: await hashPassword(input.password ?? PASSWORD),
      status: "ACTIVE"
    }
  });
}

async function loginCustomerHttp(baseUrl: string, identifier: string, password = PASSWORD) {
  const response = await fetch(`${baseUrl}/api/customer-auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier, password })
  });
  assert.equal(response.status, 200);
  const cookie = cookiePair(response.headers.get("set-cookie") ?? "");
  assert.match(cookie, /^ysabelle_customer_session=/);
  return cookie;
}

async function cleanupCustomers(emails: string[]) {
  const customers = await prisma.customerAccount.findMany({
    where: { email: { in: emails } },
    select: { id: true }
  });
  const ids = customers.map((customer) => customer.id);
  if (ids.length > 0) {
    await prisma.customerSession.deleteMany({ where: { customerAccountId: { in: ids } } });
  }
  await prisma.customerAccount.deleteMany({ where: { email: { in: emails } } });
}

test("account profile update preserves sign-in identifiers and legacy username claim is explicit and one-time", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `account-profile-${suffix}@example.com`;
  const claimedUsername = `legacy.${suffix}`;

  try {
    await createCustomer({
      name: "Legacy Customer",
      username: null,
      email
    });

    await withServer(async (baseUrl) => {
      const cookie = await loginCustomerHttp(baseUrl, email);

      const rejectedOrigin = await fetch(`${baseUrl}/api/customer-account/profile`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          Cookie: cookie,
          Origin: "https://untrusted.example"
        },
        body: JSON.stringify({ name: "Blocked Name" })
      });
      assert.equal(rejectedOrigin.status, 403);

      const profile = await fetch(`${baseUrl}/api/customer-account/profile`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          Cookie: cookie,
          Origin: "http://localhost:5173"
        },
        body: JSON.stringify({ name: "Updated Customer" })
      });
      assert.equal(profile.status, 200);
      const profileBody = await json(profile);
      assert.equal(profileBody.data?.customer?.name, "Updated Customer");
      assert.equal(profileBody.data?.customer?.email, email);
      assert.equal(profileBody.data?.customer?.username, null);

      const wrongPassword = await fetch(`${baseUrl}/api/customer-account/username/claim`, {
        method: "POST",
        headers: { "content-type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          username: claimedUsername,
          currentPassword: "wrong-password"
        })
      });
      assert.equal(wrongPassword.status, 401);
      assert.equal((await json(wrongPassword)).error?.code, "CUSTOMER_REAUTHENTICATION_FAILED");

      const claim = await fetch(`${baseUrl}/api/customer-account/username/claim`, {
        method: "POST",
        headers: { "content-type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          username: claimedUsername.toUpperCase(),
          currentPassword: PASSWORD
        })
      });
      assert.equal(claim.status, 200);
      assert.equal((await json(claim)).data?.customer?.username, claimedUsername);

      const secondClaim = await fetch(`${baseUrl}/api/customer-account/username/claim`, {
        method: "POST",
        headers: { "content-type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          username: `other.${suffix}`,
          currentPassword: PASSWORD
        })
      });
      assert.equal(secondClaim.status, 409);
      assert.equal((await json(secondClaim)).error?.code, "CUSTOMER_USERNAME_ALREADY_SET");

      const usernameLogin = await fetch(`${baseUrl}/api/customer-auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier: claimedUsername, password: PASSWORD })
      });
      assert.equal(usernameLogin.status, 200);
    });
  } finally {
    await cleanupCustomers([email]);
  }
});

test("concurrent legacy username claims cannot assign the same username to two accounts", async () => {
  const suffix = randomUUID().slice(0, 8);
  const firstEmail = `claim-first-${suffix}@example.com`;
  const secondEmail = `claim-second-${suffix}@example.com`;
  const targetUsername = `claimed.${suffix}`;

  try {
    await createCustomer({ name: "First Customer", username: null, email: firstEmail });
    await createCustomer({ name: "Second Customer", username: null, email: secondEmail });

    await withServer(async (baseUrl) => {
      const firstCookie = await loginCustomerHttp(baseUrl, firstEmail);
      const secondCookie = await loginCustomerHttp(baseUrl, secondEmail);

      const [first, second] = await Promise.all([
        fetch(`${baseUrl}/api/customer-account/username/claim`, {
          method: "POST",
          headers: { "content-type": "application/json", Cookie: firstCookie },
          body: JSON.stringify({ username: targetUsername, currentPassword: PASSWORD })
        }),
        fetch(`${baseUrl}/api/customer-account/username/claim`, {
          method: "POST",
          headers: { "content-type": "application/json", Cookie: secondCookie },
          body: JSON.stringify({ username: targetUsername, currentPassword: PASSWORD })
        })
      ]);

      const statuses = [first.status, second.status].sort((left, right) => left - right);
      assert.deepEqual(statuses, [200, 409]);

      const owners = await prisma.customerAccount.count({ where: { username: targetUsername } });
      assert.equal(owners, 1);
    });
  } finally {
    await cleanupCustomers([firstEmail, secondEmail]);
  }
});

test("password change verifies the current password, upgrades the hash, revokes old sessions, and rotates the current cookie", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `account-password-${suffix}@example.com`;

  try {
    await createCustomer({
      name: "Password Customer",
      username: `password.${suffix}`,
      email
    });

    await withServer(async (baseUrl) => {
      const firstCookie = await loginCustomerHttp(baseUrl, email);
      const secondCookie = await loginCustomerHttp(baseUrl, email);

      const wrongPassword = await fetch(`${baseUrl}/api/customer-account/password/change`, {
        method: "POST",
        headers: { "content-type": "application/json", Cookie: firstCookie },
        body: JSON.stringify({ currentPassword: "wrong-password", newPassword: NEW_PASSWORD })
      });
      assert.equal(wrongPassword.status, 401);

      const change = await fetch(`${baseUrl}/api/customer-account/password/change`, {
        method: "POST",
        headers: { "content-type": "application/json", Cookie: firstCookie },
        body: JSON.stringify({ currentPassword: PASSWORD, newPassword: NEW_PASSWORD })
      });
      assert.equal(change.status, 200);
      const rotatedCookie = cookiePair(change.headers.get("set-cookie") ?? "");
      assert.match(rotatedCookie, /^ysabelle_customer_session=/);
      assert.notEqual(rotatedCookie, firstCookie);

      const firstOldSession = await fetch(`${baseUrl}/api/customer-auth/me`, {
        headers: { Cookie: firstCookie }
      });
      const secondOldSession = await fetch(`${baseUrl}/api/customer-auth/me`, {
        headers: { Cookie: secondCookie }
      });
      const rotatedSession = await fetch(`${baseUrl}/api/customer-auth/me`, {
        headers: { Cookie: rotatedCookie }
      });
      assert.equal(firstOldSession.status, 401);
      assert.equal(secondOldSession.status, 401);
      assert.equal(rotatedSession.status, 200);

      const customer = await prisma.customerAccount.findUniqueOrThrow({ where: { email } });
      assert.equal(await verifyPassword(NEW_PASSWORD, customer.passwordHash), true);
      assert.equal(passwordHashNeedsUpgrade(customer.passwordHash), false);

      const oldPasswordLogin = await fetch(`${baseUrl}/api/customer-auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier: email, password: PASSWORD })
      });
      assert.equal(oldPasswordLogin.status, 401);

      const newPasswordLogin = await fetch(`${baseUrl}/api/customer-auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier: email, password: NEW_PASSWORD })
      });
      assert.equal(newPasswordLogin.status, 200);
    });
  } finally {
    await cleanupCustomers([email]);
  }
});

test("session management exposes metadata only and sign-out-others preserves the current session", async () => {
  const suffix = randomUUID().slice(0, 8);
  const email = `account-sessions-${suffix}@example.com`;

  try {
    await createCustomer({
      name: "Session Customer",
      username: `sessions.${suffix}`,
      email
    });

    await withServer(async (baseUrl) => {
      const currentCookie = await loginCustomerHttp(baseUrl, email);
      const otherCookie = await loginCustomerHttp(baseUrl, email);

      const sessionsResponse = await fetch(`${baseUrl}/api/customer-account/sessions`, {
        headers: { Cookie: currentCookie }
      });
      assert.equal(sessionsResponse.status, 200);
      const sessionsBody = await json(sessionsResponse);
      assert.equal(sessionsBody.data?.sessions?.length, 2);
      assert.equal(sessionsBody.data?.sessions?.filter((session) => session.current).length, 1);
      assert.equal(JSON.stringify(sessionsBody).includes("tokenHash"), false);
      assert.equal(JSON.stringify(sessionsBody).includes("sessionToken"), false);
      assert.ok(sessionsBody.data?.sessions?.every((session) => Boolean(session.createdAt)));
      assert.ok(sessionsBody.data?.sessions?.every((session) => Boolean(session.expiresAt)));

      const revoke = await fetch(`${baseUrl}/api/customer-account/sessions/revoke-others`, {
        method: "POST",
        headers: { "content-type": "application/json", Cookie: currentCookie },
        body: JSON.stringify({ currentPassword: PASSWORD })
      });
      assert.equal(revoke.status, 200);
      assert.equal((await json(revoke)).data?.revokedCount, 1);

      const currentSession = await fetch(`${baseUrl}/api/customer-auth/me`, {
        headers: { Cookie: currentCookie }
      });
      const otherSession = await fetch(`${baseUrl}/api/customer-auth/me`, {
        headers: { Cookie: otherCookie }
      });
      assert.equal(currentSession.status, 200);
      assert.equal(otherSession.status, 401);
    });
  } finally {
    await cleanupCustomers([email]);
  }
});
