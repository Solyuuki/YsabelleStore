import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createApp } from "../src/app.js";

const GENERIC_REQUEST_MESSAGE =
  "If an eligible account exists, a verification code has been sent to its registered email.";
const GENERIC_CODE_MESSAGE = "The verification code is invalid or expired. Request a new code.";
const GENERIC_GRANT_MESSAGE = "This recovery session is invalid or expired. Request a new code.";

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

test("recovery request is enumeration-resistant, token-free, and disables sensitive response caching", async () => {
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
    assert.equal(JSON.stringify(payload).includes("verificationCode"), false);
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

    const verifyMalformed = await fetch(`${baseUrl}/api/customer-auth/recovery/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: "customer@example.com", verificationCode: "123" })
    });
    assert.equal(verifyMalformed.status, 400);
    assert.equal(
      (await body(verifyMalformed)).error?.code,
      "INVALID_CUSTOMER_RECOVERY_VERIFICATION_REQUEST"
    );

    const resetMalformed = await fetch(`${baseUrl}/api/customer-auth/recovery/reset`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newPassword: "short" })
    });
    assert.equal(resetMalformed.status, 400);
    assert.equal(
      (await body(resetMalformed)).error?.code,
      "INVALID_CUSTOMER_PASSWORD_RESET_REQUEST"
    );

    const disallowed = await fetch(`${baseUrl}/api/customer-auth/recovery/verify`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://evil.example"
      },
      body: JSON.stringify({ identifier: "customer@example.com", verificationCode: "123456" })
    });
    assert.equal(disallowed.status, 403);
    assert.equal((await body(disallowed)).error?.code, "CUSTOMER_AUTH_ORIGIN_REJECTED");
  });
});

test("unknown verification identities use one generic OTP error", async () => {
  const suffix = randomUUID().slice(0, 8);
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/customer-auth/recovery/verify`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:5173"
      },
      body: JSON.stringify({
        identifier: `missing-verify-${suffix}@example.com`,
        verificationCode: "123456"
      })
    });

    assert.equal(response.status, 400);
    const payload = await body(response);
    assert.equal(payload.error?.code, "CUSTOMER_PASSWORD_RECOVERY_CODE_INVALID");
    assert.equal(payload.message, GENERIC_CODE_MESSAGE);
  });
});

test("password reset requires a valid HttpOnly recovery grant cookie", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/customer-auth/recovery/reset`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:5173"
      },
      body: JSON.stringify({ newPassword: "NewPassword456!" })
    });

    assert.equal(response.status, 400);
    const payload = await body(response);
    assert.equal(payload.error?.code, "CUSTOMER_PASSWORD_RECOVERY_INVALID");
    assert.equal(payload.message, GENERIC_GRANT_MESSAGE);
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
