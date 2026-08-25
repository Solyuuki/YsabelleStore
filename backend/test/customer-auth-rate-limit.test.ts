import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";

import express from "express";

import { createApp } from "../src/app.js";
import { errorHandler } from "../src/middleware/errorHandler.js";
import {
  createAuthRateLimit,
  derivePrivateRateLimitKey,
  inspectAuthRateLimitKeysForTest
} from "../src/middleware/authRateLimit.js";

async function withServer(app: ReturnType<typeof express>, run: (baseUrl: string) => Promise<void>) {
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

async function postLogin(baseUrl: string, email: string) {
  return fetch(`${baseUrl}/api/customer-auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "DefinitelyWrong123!" })
  });
}

test("customer login throttles one normalized identifier before the broader IP allowance", async () => {
  const app = createApp();

  await withServer(app, async (baseUrl) => {
    const email = `  RATE-LIMIT-${Date.now()}@EXAMPLE.COM  `;

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await postLogin(baseUrl, email);
      assert.equal(response.status, 401, `attempt ${attempt} must reach credential validation`);
    }

    const blocked = await postLogin(baseUrl, email.toLowerCase());
    const blockedBody = (await blocked.json()) as {
      success?: boolean;
      error?: { code?: string };
    };

    assert.equal(blocked.status, 429);
    assert.equal(blockedBody.error?.code, "AUTH_RATE_LIMITED");
    assert.ok(Number(blocked.headers.get("retry-after")) >= 1);

    const differentIdentifier = await postLogin(
      baseUrl,
      `different-${Date.now()}@example.com`
    );
    assert.equal(
      differentIdentifier.status,
      401,
      "a different identifier must remain below the 10-attempt IP allowance"
    );
  });
});

test("privacy-safe identifier limiter stores only HMAC-derived keys", async () => {
  const rawEmail = "  Customer.RateLimit@Example.COM ";
  const normalizedEmail = rawEmail.trim().toLowerCase();
  const derivedKey = derivePrivateRateLimitKey("customer-login-identifier", normalizedEmail);

  assert.match(derivedKey, /^[a-f0-9]{64}$/);
  assert.equal(derivedKey.includes(normalizedEmail), false);
  assert.equal(
    derivePrivateRateLimitKey("customer-login-identifier", normalizedEmail),
    derivedKey,
    "the same process must derive a stable limiter key for the same normalized identifier"
  );

  const limiter = createAuthRateLimit({
    windowMs: 60_000,
    maxAttempts: 2,
    scope: "privacy-storage-test",
    keyResolver(request) {
      const body = request.body as { email?: unknown } | undefined;
      if (typeof body?.email !== "string") return null;
      return derivePrivateRateLimitKey(
        "privacy-storage-test-identifier",
        body.email.trim().toLowerCase()
      );
    }
  });

  const app = express();
  app.use(express.json());
  app.post("/login", limiter, (_request, response) => response.status(401).json({ success: false }));
  app.use(errorHandler);

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: rawEmail })
    });
    assert.equal(response.status, 401);
  });

  const storedKeys = inspectAuthRateLimitKeysForTest(limiter);
  assert.equal(storedKeys.length, 1);
  assert.equal(storedKeys[0]?.includes(normalizedEmail), false);
  assert.match(storedKeys[0] ?? "", /^[a-f0-9]{64}$/);
});
