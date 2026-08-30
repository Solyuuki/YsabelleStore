import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createApp } from "../src/app.js";
import { prisma } from "../src/database/prismaClient.js";
import { normalizePhilippineMobile } from "../src/utils/customerIdentity.js";

type ApiBody = {
  success?: boolean;
  data?: unknown;
};

type RegistrationMobileChallengeRow = {
  id: string;
  registrationIntentHash: string;
  phoneNormalized: string;
  otpHash: string;
  failedAttempts: number;
  consumedAt: Date | null;
  expiresAt: Date;
};

const createdIntentHashes: string[] = [];

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

function cookiePair(response: Response) {
  return (response.headers.get("set-cookie") ?? "").split(";")[0];
}

function cookieValue(cookie: string) {
  return decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1));
}

function intentHash(intentCookie: string) {
  return createHash("sha256").update(cookieValue(intentCookie)).digest("hex");
}

function testPhone(suffix: string) {
  const numeric = Number.parseInt(suffix.slice(0, 7), 16) % 10_000_000;
  return `0917${numeric.toString().padStart(7, "0")}`;
}

test("registration can request a privacy-safe mobile verification code", async () => {
  await withServer(async (baseUrl) => {
    const intentResponse = await fetch(`${baseUrl}/api/customer-auth/registration-intent`);
    assert.equal(intentResponse.status, 200);
    const intentCookie = cookiePair(intentResponse);
    assert.ok(intentCookie);

    await new Promise((resolve) => setTimeout(resolve, 800));

    const response = await fetch(`${baseUrl}/api/customer-auth/registration/mobile/request`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: intentCookie
      },
      body: JSON.stringify({ phone: "09171234567" })
    });

    assert.equal(response.status, 200);
    const body = (await response.json()) as ApiBody;
    assert.equal(body.success, true);
    assert.equal(body.data, undefined);
    assert.equal(JSON.stringify(body).includes("09171234567"), false);
  });
});

test("registration mobile verification uses a dedicated hashed intent-bound challenge", async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
  const phone = testPhone(suffix);
  const phoneNormalized = normalizePhilippineMobile(phone);
  assert.ok(phoneNormalized);

  await withServer(async (baseUrl) => {
    const intentResponse = await fetch(`${baseUrl}/api/customer-auth/registration-intent`);
    assert.equal(intentResponse.status, 200);
    const intentCookie = cookiePair(intentResponse);
    assert.ok(intentCookie);
    const registrationIntentHash = intentHash(intentCookie);
    createdIntentHashes.push(registrationIntentHash);

    await new Promise((resolve) => setTimeout(resolve, 800));
    const before = Date.now();
    const response = await fetch(`${baseUrl}/api/customer-auth/registration/mobile/request`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: intentCookie
      },
      body: JSON.stringify({ phone })
    });
    const after = Date.now();
    assert.equal(response.status, 200);

    const rows = await prisma.$queryRaw<RegistrationMobileChallengeRow[]>`
      SELECT
        id,
        registration_intent_hash AS registrationIntentHash,
        phone_normalized AS phoneNormalized,
        otp_hash AS otpHash,
        failed_attempts AS failedAttempts,
        consumed_at AS consumedAt,
        expires_at AS expiresAt
      FROM customer_mobile_registration_challenges
      WHERE registration_intent_hash = ${registrationIntentHash}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const challenge = rows[0];
    assert.ok(challenge, "Expected a dedicated registration mobile OTP challenge.");
    assert.match(challenge.id, /^registration-mobile-otp:/);
    assert.equal(challenge.registrationIntentHash, registrationIntentHash);
    assert.equal(challenge.phoneNormalized, phoneNormalized);
    assert.match(challenge.otpHash, /^[a-f0-9]{64}$/i);
    assert.equal(Number(challenge.failedAttempts), 0);
    assert.equal(challenge.consumedAt, null);
    assert.ok(new Date(challenge.expiresAt).getTime() >= before + 9 * 60 * 1000);
    assert.ok(new Date(challenge.expiresAt).getTime() <= after + 11 * 60 * 1000);
  });
});

test.after(async () => {
  if (createdIntentHashes.length === 0) return;

  const placeholders = createdIntentHashes.map(() => "?").join(", ");
  await prisma.$executeRawUnsafe(
    `DELETE FROM customer_mobile_registration_challenges WHERE registration_intent_hash IN (${placeholders})`,
    ...createdIntentHashes
  );
});
