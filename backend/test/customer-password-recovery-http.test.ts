import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createApp } from "../src/app.js";

const GENERIC_REQUEST_MESSAGE =
  "If an eligible account exists, recovery instructions have been sent to its registered email.";
const GENERIC_RESET_MESSAGE = "This recovery link is invalid or expired. Request a new one.";

type ApiBody = {
  success?: boolean;
  message?: string;
  error?: { code?: string };
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

async function body(response: Response): Promise<ApiBody> {
  return (await response.json()) as ApiBody;
}

test("recovery request is enumeration-resistant and disables sensitive response caching", async () => {
  const suffix = randomUUID().slice(0, 8);
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/customer-auth/recovery/request`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:5173"
      },
      body: JSON.stringify({ identifier: `missing-${suffix}@example.com` })
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("pragma"), "no-cache");
    const payload = await body(response);
    assert.equal(payload.success, true);
    assert.equal(payload.message, GENERIC_REQUEST_MESSAGE);
    assert.equal(JSON.stringify(payload).includes("token"), false);
  });
});

test("recovery endpoints reject malformed bodies and disallowed origins", async () => {
  await withServer(async (baseUrl) => {
    const malformed = await fetch(`${baseUrl}/api/customer-auth/recovery/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: "" })
    });
    assert.equal(malformed.status, 400);
    assert.equal((await body(malformed)).error?.code, "INVALID_CUSTOMER_RECOVERY_REQUEST");

    const disallowed = await fetch(`${baseUrl}/api/customer-auth/recovery/request`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example"
      },
      body: JSON.stringify({ identifier: "customer@example.com" })
    });
    assert.equal(disallowed.status, 403);
    assert.equal((await body(disallowed)).error?.code, "CUSTOMER_AUTH_ORIGIN_REJECTED");

    const resetMalformed = await fetch(`${baseUrl}/api/customer-auth/recovery/reset`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "short", newPassword: "short" })
    });
    assert.equal(resetMalformed.status, 400);
    assert.equal((await body(resetMalformed)).error?.code, "INVALID_CUSTOMER_PASSWORD_RESET_REQUEST");
  });
});

test("unknown reset tokens use one generic recovery-link error", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/customer-auth/recovery/reset`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:5173"
      },
      body: JSON.stringify({
        token: "unknown-recovery-token-value-that-is-long-enough-123456",
        newPassword: "NewPassword456!"
      })
    });

    assert.equal(response.status, 400);
    const payload = await body(response);
    assert.equal(payload.error?.code, "CUSTOMER_PASSWORD_RECOVERY_INVALID");
    assert.equal(payload.message, GENERIC_RESET_MESSAGE);
  });
});

test("recovery request limits repeated normalized identities without echoing the identity", async () => {
  const suffix = randomUUID().slice(0, 8);
  const identifier = `rate-${suffix}@example.com`;

  await withServer(async (baseUrl) => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/customer-auth/recovery/request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier: attempt === 2 ? identifier.toUpperCase() : identifier })
      });
      assert.equal(response.status, 200);
    }

    const limited = await fetch(`${baseUrl}/api/customer-auth/recovery/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier })
    });
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get("retry-after")) >= 1);
    const payloadText = JSON.stringify(await body(limited));
    assert.equal(payloadText.includes(identifier), false);
  });
});
