import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";

import express from "express";
import jwt from "jsonwebtoken";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { prisma } from "../src/database/prismaClient.js";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { createAuthRateLimit } from "../src/middleware/authRateLimit.js";
import {
  getUserFromToken,
  loginWithPassword,
  restoreTrustedDeviceSession
} from "../src/services/authService.js";
import { hashPassword } from "../src/services/passwordHashService.js";
import { HttpError } from "../src/utils/httpError.js";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const TEST_PASSWORD = "InternalPass123!";

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

async function withRateLimitServer(run: (baseUrl: string) => Promise<void>) {
  const app = express();
  app.use(
    "/login",
    createAuthRateLimit({ windowMs: 60_000, maxAttempts: 2, scope: "auth-security-test" })
  );
  app.post("/login", (_request, response) => response.status(401).json({ success: false }));
  app.use(errorHandler);

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

async function createInternalUser() {
  const suffix = randomUUID().slice(0, 8);
  return prisma.user.create({
    data: {
      name: `Security Test ${suffix}`,
      email: `security-${suffix}@example.com`,
      passwordHash: await hashPassword(TEST_PASSWORD),
      role: "OWNER",
      status: "ACTIVE"
    }
  });
}

function requireJwtSecret() {
  assert.ok(env.JWT_SECRET, "JWT_SECRET must be configured for auth security tests");
  return env.JWT_SECRET;
}

function hashTrustedDeviceToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function expectHttpError(
  operation: () => Promise<unknown>,
  expected: { statusCode: number; code: string }
) {
  await assert.rejects(operation, (error: unknown) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.statusCode, expected.statusCode);
    assert.equal(error.code, expected.code);
    return true;
  });
}

test("internal bearer tokens require the internal token discriminator", async () => {
  const user = await createInternalUser();

  try {
    const legacyToken = jwt.sign({ email: user.email, role: user.role }, requireJwtSecret(), {
      expiresIn: "8h",
      subject: user.id
    });
    const typedToken = jwt.sign(
      { tokenType: "internal", email: user.email, role: user.role },
      requireJwtSecret(),
      { expiresIn: "8h", subject: user.id }
    );

    await expectHttpError(() => getUserFromToken(legacyToken), {
      statusCode: 401,
      code: "INVALID_AUTH_TOKEN"
    });

    const resolved = await getUserFromToken(typedToken);
    assert.equal(resolved.id, user.id);
    assert.equal(resolved.role, "OWNER");
  } finally {
    await prisma.trustedDevice.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("internal login does not reveal whether an account exists", async () => {
  const user = await createInternalUser();

  try {
    await withServer(async (baseUrl) => {
      const missingResponse = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: `missing-${randomUUID().slice(0, 8)}@example.com`,
          password: "WrongPass123!"
        })
      });
      const wrongPasswordResponse = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          password: "WrongPass123!"
        })
      });

      const missingBody = (await missingResponse.json()) as {
        success?: boolean;
        message?: string;
        error?: { code?: string };
      };
      const wrongPasswordBody = (await wrongPasswordResponse.json()) as {
        success?: boolean;
        message?: string;
        error?: { code?: string };
      };

      assert.equal(missingResponse.status, 401);
      assert.equal(wrongPasswordResponse.status, 401);
      assert.deepEqual(
        {
          success: missingBody.success,
          message: missingBody.message,
          code: missingBody.error?.code
        },
        {
          success: wrongPasswordBody.success,
          message: wrongPasswordBody.message,
          code: wrongPasswordBody.error?.code
        }
      );
      assert.equal(missingBody.message, "Invalid email or password.");
      assert.equal(missingBody.error?.code, "INVALID_CREDENTIALS");
    });
  } finally {
    await prisma.trustedDevice.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("password login creates trusted-device access with a finite 30-day expiry", async () => {
  const user = await createInternalUser();
  const beforeLogin = Date.now();

  try {
    const session = await loginWithPassword(
      { email: user.email, password: TEST_PASSWORD },
      { userAgent: "auth-security-test" }
    );
    assert.ok(session.trustedDeviceToken);

    const trustedDevice = await prisma.trustedDevice.findUniqueOrThrow({
      where: { tokenHash: hashTrustedDeviceToken(session.trustedDeviceToken) }
    });
    const expiresAt = trustedDevice.expiresAt?.getTime();

    assert.ok(expiresAt, "trusted device must have a finite expiry");
    assert.ok(expiresAt >= beforeLogin + THIRTY_DAYS_MS - 5_000);
    assert.ok(expiresAt <= Date.now() + THIRTY_DAYS_MS + 5_000);
  } finally {
    await prisma.trustedDevice.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("expired or legacy null-expiry trusted devices require password re-authentication", async () => {
  const user = await createInternalUser();
  const expiredToken = randomBytes(32).toString("base64url");
  const legacyToken = randomBytes(32).toString("base64url");

  try {
    await prisma.trustedDevice.createMany({
      data: [
        {
          userId: user.id,
          tokenHash: hashTrustedDeviceToken(expiredToken),
          deviceLabel: "Expired test device",
          expiresAt: new Date(Date.now() - 60_000)
        },
        {
          userId: user.id,
          tokenHash: hashTrustedDeviceToken(legacyToken),
          deviceLabel: "Legacy null-expiry device",
          expiresAt: null
        }
      ]
    });

    await expectHttpError(() => restoreTrustedDeviceSession({ trustedDeviceToken: expiredToken }), {
      statusCode: 401,
      code: "TRUSTED_DEVICE_INVALID"
    });
    await expectHttpError(() => restoreTrustedDeviceSession({ trustedDeviceToken: legacyToken }), {
      statusCode: 401,
      code: "TRUSTED_DEVICE_INVALID"
    });
  } finally {
    await prisma.trustedDevice.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
});

test("auth rate limiter returns 429 with Retry-After after the configured allowance", async () => {
  await withRateLimitServer(async (baseUrl) => {
    const first = await fetch(`${baseUrl}/login`, { method: "POST" });
    const second = await fetch(`${baseUrl}/login`, { method: "POST" });
    const blocked = await fetch(`${baseUrl}/login`, { method: "POST" });
    const body = (await blocked.json()) as {
      success?: boolean;
      error?: { code?: string };
    };

    assert.equal(first.status, 401);
    assert.equal(second.status, 401);
    assert.equal(blocked.status, 429);
    assert.equal(body.success, false);
    assert.equal(body.error?.code, "AUTH_RATE_LIMITED");
    assert.ok(Number(blocked.headers.get("retry-after")) >= 1);
  });
});

test("normal API traffic no longer advertises the retired global rate-limit placeholder", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-rate-limit-policy"), null);
  });
});
