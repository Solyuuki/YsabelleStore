import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
import { AUTH_RATE_LIMITS } from "../src/security/security.constants.js";
import { classifyCustomerLoginIdentifier } from "../src/utils/customerIdentity.js";

async function withServer(
  app: ReturnType<typeof express>,
  run: (baseUrl: string) => Promise<void>
) {
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

function createForwardedIpApp() {
  const app = createApp();
  app.set("trust proxy", 1);
  return app;
}

async function postLogin(baseUrl: string, identifier: string, forwardedIp: string) {
  return fetch(`${baseUrl}/api/customer-auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": forwardedIp
    },
    body: JSON.stringify({ identifier, password: "DefinitelyWrong123!" })
  });
}

async function postRegistrationWithoutIntent(
  baseUrl: string,
  input: { username: string; email: string; phone?: string },
  forwardedIp: string
) {
  return fetch(`${baseUrl}/api/customer-auth/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": forwardedIp
    },
    body: JSON.stringify({
      name: "Rate Limit Customer",
      ...input,
      password: "CustomerPass123!"
    })
  });
}

async function assertRateLimited(response: Response) {
  const body = (await response.json()) as {
    success?: boolean;
    error?: { code?: string };
  };

  assert.equal(response.status, 429);
  assert.equal(body.error?.code, "AUTH_RATE_LIMITED");
  assert.ok(Number(response.headers.get("retry-after")) >= 1);
}

test("customer login keeps the Phase 1 IP and identifier thresholds", () => {
  assert.equal(AUTH_RATE_LIMITS.customerLogin.maxAttempts, 10);
  assert.equal(AUTH_RATE_LIMITS.customerLoginIdentifier.maxAttempts, 5);
  assert.equal(AUTH_RATE_LIMITS.customerRegister.maxAttempts, 5);
  assert.equal(AUTH_RATE_LIMITS.customerRegisterIdentity.maxAttempts, 3);
});

test("customer login throttles equivalent email identifiers before the broader IP allowance", async () => {
  const app = createForwardedIpApp();
  const suffix = randomUUID().slice(0, 8);
  const email = `rate-limit-${suffix}@example.com`;
  const forwardedIp = "198.51.100.11";

  await withServer(app, async (baseUrl) => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const identifier = attempt % 2 === 0 ? email.toUpperCase() : `  ${email}  `;
      const response = await postLogin(baseUrl, identifier, forwardedIp);
      assert.equal(response.status, 401, `attempt ${attempt} must reach credential validation`);
    }

    await assertRateLimited(await postLogin(baseUrl, email.toUpperCase(), forwardedIp));

    const differentIdentifier = await postLogin(
      baseUrl,
      `different-${suffix}@example.com`,
      forwardedIp
    );
    assert.equal(
      differentIdentifier.status,
      401,
      "a different identifier must remain below the 10-attempt IP allowance"
    );
  });
});

test("customer login throttles username case variants as one private identifier bucket", async () => {
  const app = createForwardedIpApp();
  const suffix = randomUUID().slice(0, 8);
  const username = `rate.user.${suffix}`;
  const forwardedIp = "198.51.100.12";

  await withServer(app, async (baseUrl) => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const identifier = attempt % 2 === 0 ? username.toUpperCase() : username;
      const response = await postLogin(baseUrl, identifier, forwardedIp);
      assert.equal(response.status, 401, `attempt ${attempt} must reach credential validation`);
    }

    await assertRateLimited(await postLogin(baseUrl, username.toUpperCase(), forwardedIp));
  });
});

test("customer login throttles equivalent Philippine mobile representations as one private bucket", async () => {
  const app = createForwardedIpApp();
  const forwardedIp = "198.51.100.13";
  const variants = [
    "09175550123",
    "639175550123",
    "+639175550123",
    "0917 555 0123",
    "(+63) 917 555 0123"
  ];

  await withServer(app, async (baseUrl) => {
    for (const identifier of variants) {
      const response = await postLogin(baseUrl, identifier, forwardedIp);
      assert.equal(response.status, 401);
    }

    await assertRateLimited(await postLogin(baseUrl, "0917-555-0123", forwardedIp));
  });
});

test("registration email identity cannot be bypassed by changing username", async () => {
  const app = createForwardedIpApp();
  const suffix = randomUUID().slice(0, 8);
  const email = `register-email-${suffix}@example.com`;
  const forwardedIp = "198.51.100.21";

  await withServer(app, async (baseUrl) => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const response = await postRegistrationWithoutIntent(
        baseUrl,
        {
          username: `email.guard.${attempt}.${suffix}`,
          email: attempt % 2 === 0 ? email.toUpperCase() : email
        },
        forwardedIp
      );
      assert.equal(
        response.status,
        403,
        `attempt ${attempt} must reach registration-intent validation`
      );
    }

    await assertRateLimited(
      await postRegistrationWithoutIntent(
        baseUrl,
        { username: `email.guard.4.${suffix}`, email: email.toUpperCase() },
        forwardedIp
      )
    );
  });
});

test("registration username identity cannot be bypassed by changing email", async () => {
  const app = createForwardedIpApp();
  const suffix = randomUUID().slice(0, 8);
  const username = `register.user.${suffix}`;
  const forwardedIp = "198.51.100.22";

  await withServer(app, async (baseUrl) => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const response = await postRegistrationWithoutIntent(
        baseUrl,
        {
          username: attempt % 2 === 0 ? username.toUpperCase() : username,
          email: `username-guard-${attempt}-${suffix}@example.com`
        },
        forwardedIp
      );
      assert.equal(
        response.status,
        403,
        `attempt ${attempt} must reach registration-intent validation`
      );
    }

    await assertRateLimited(
      await postRegistrationWithoutIntent(
        baseUrl,
        {
          username: username.toUpperCase(),
          email: `username-guard-4-${suffix}@example.com`
        },
        forwardedIp
      )
    );
  });
});

test("registration mobile identity cannot be bypassed by changing username and email or phone presentation", async () => {
  const app = createForwardedIpApp();
  const suffix = randomUUID().slice(0, 8);
  const forwardedIp = "198.51.100.23";
  const phoneVariants = ["09176660123", "639176660123", "+639176660123"];

  await withServer(app, async (baseUrl) => {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const response = await postRegistrationWithoutIntent(
        baseUrl,
        {
          username: `phone.guard.${attempt}.${suffix}`,
          email: `phone-guard-${attempt}-${suffix}@example.com`,
          phone: phoneVariants[attempt - 1]
        },
        forwardedIp
      );
      assert.equal(
        response.status,
        403,
        `attempt ${attempt} must reach registration-intent validation`
      );
    }

    await assertRateLimited(
      await postRegistrationWithoutIntent(
        baseUrl,
        {
          username: `phone.guard.4.${suffix}`,
          email: `phone-guard-4-${suffix}@example.com`,
          phone: "0917-666-0123"
        },
        forwardedIp
      )
    );
  });
});

test("privacy-safe identifier limiter stores only HMAC-derived class-prefixed canonical keys", async () => {
  const rawIdentifier = "  Customer.RateLimit@Example.COM ";
  const classified = classifyCustomerLoginIdentifier(rawIdentifier);
  assert.deepEqual(classified, {
    kind: "email",
    normalized: "customer.ratelimit@example.com"
  });

  const privateIdentity = `${classified.kind}:${classified.normalized}`;
  const derivedKey = derivePrivateRateLimitKey("customer-login-identifier", privateIdentity);

  assert.match(derivedKey, /^[a-f0-9]{64}$/);
  assert.equal(derivedKey.includes(rawIdentifier), false);
  assert.equal(derivedKey.includes(classified.normalized), false);
  assert.equal(
    derivePrivateRateLimitKey("customer-login-identifier", privateIdentity),
    derivedKey,
    "the same process must derive a stable limiter key for the same canonical identifier"
  );

  const limiter = createAuthRateLimit({
    windowMs: 60_000,
    maxAttempts: 2,
    scope: "privacy-storage-test",
    keyResolver(request) {
      const body = request.body as { identifier?: unknown } | undefined;
      if (typeof body?.identifier !== "string") return null;

      const identity = classifyCustomerLoginIdentifier(body.identifier);
      if (!identity) return null;

      return derivePrivateRateLimitKey(
        "privacy-storage-test-identifier",
        `${identity.kind}:${identity.normalized}`
      );
    }
  });

  const app = express();
  app.use(express.json());
  app.post("/login", limiter, (_request, response) =>
    response.status(401).json({ success: false })
  );
  app.use(errorHandler);

  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: rawIdentifier })
    });
    assert.equal(response.status, 401);
  });

  const storedKeys = inspectAuthRateLimitKeysForTest(limiter);
  assert.equal(storedKeys.length, 1);
  assert.equal(storedKeys[0]?.includes(rawIdentifier), false);
  assert.equal(storedKeys[0]?.includes(classified.normalized), false);
  assert.match(storedKeys[0] ?? "", /^[a-f0-9]{64}$/);
});
