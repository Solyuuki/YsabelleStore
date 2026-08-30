import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { prisma } from "../src/database/prismaClient.js";
import { normalizePhilippineMobile } from "../src/utils/customerIdentity.js";

type ApiBody = {
  success?: boolean;
  data?: {
    customer?: {
      id?: string;
    };
  };
  error?: {
    code?: string;
  };
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
const createdCustomerEmails: string[] = [];

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

function registrationOtpHash(
  challengeId: string,
  registrationIntentHash: string,
  phoneNormalized: string,
  verificationCode: string
) {
  const secret = env.JWT_SECRET?.trim();
  assert.ok(secret);

  return createHmac("sha256", secret)
    .update(
      `customer-mobile-registration-otp:v1:${challengeId}:${registrationIntentHash}:${phoneNormalized}:${verificationCode}`
    )
    .digest("hex");
}

function testPhone(suffix: string) {
  const numeric = Number.parseInt(suffix.slice(0, 7), 16) % 10_000_000;
  return `0917${numeric.toString().padStart(7, "0")}`;
}

function registrationPayload(suffix: string, phone?: string) {
  const email = `registration-mobile-${suffix}@example.com`;
  createdCustomerEmails.push(email);
  return {
    name: "Registration Mobile Customer",
    username: `regmobile.${suffix}`,
    email,
    phone,
    password: "RegistrationMobile123!"
  };
}

async function issueRegistrationIntent(baseUrl: string) {
  const response = await fetch(`${baseUrl}/api/customer-auth/registration-intent`);
  assert.equal(response.status, 200);
  const intentCookie = cookiePair(response);
  assert.ok(intentCookie);
  const registrationIntentHash = intentHash(intentCookie);
  createdIntentHashes.push(registrationIntentHash);
  await new Promise((resolve) => setTimeout(resolve, 800));
  return { intentCookie, registrationIntentHash };
}

async function createVerifiedRegistrationMobileGrant(input: {
  baseUrl: string;
  intentCookie: string;
  registrationIntentHash: string;
  phone: string;
  verificationCode?: string;
}) {
  const phoneNormalized = normalizePhilippineMobile(input.phone);
  assert.ok(phoneNormalized);
  const verificationCode = input.verificationCode ?? "246810";
  const challengeId = `registration-mobile-otp:${randomUUID().replaceAll("-", "")}`;

  await prisma.customerMobileRegistrationChallenge.create({
    data: {
      id: challengeId,
      registrationIntentHash: input.registrationIntentHash,
      phoneNormalized,
      otpHash: registrationOtpHash(
        challengeId,
        input.registrationIntentHash,
        phoneNormalized,
        verificationCode
      ),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000)
    }
  });

  const response = await fetch(`${input.baseUrl}/api/customer-auth/registration/mobile/verify`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: input.intentCookie
    },
    body: JSON.stringify({ phone: input.phone, verificationCode })
  });
  assert.equal(response.status, 200);
  const grantCookie = cookiePair(response);
  assert.ok(grantCookie);
  assert.match(grantCookie, /^ysabelle_customer_registration_mobile=/);
  return { challengeId, grantCookie };
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
    const { intentCookie, registrationIntentHash } = await issueRegistrationIntent(baseUrl);
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

test("valid registration mobile OTP consumes the challenge and issues an HttpOnly intent-bound grant", async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
  const phone = testPhone(suffix);

  await withServer(async (baseUrl) => {
    const { intentCookie, registrationIntentHash } = await issueRegistrationIntent(baseUrl);
    const { challengeId } = await createVerifiedRegistrationMobileGrant({
      baseUrl,
      intentCookie,
      registrationIntentHash,
      phone
    });

    const challenge = await prisma.customerMobileRegistrationChallenge.findUnique({
      where: { id: challengeId }
    });
    assert.ok(challenge?.consumedAt);
  });
});

test("registration refuses to attach a supplied mobile number without its verification grant", async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
  const phone = testPhone(suffix);

  await withServer(async (baseUrl) => {
    const { intentCookie } = await issueRegistrationIntent(baseUrl);
    const response = await fetch(`${baseUrl}/api/customer-auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: intentCookie
      },
      body: JSON.stringify(registrationPayload(suffix, phone))
    });

    assert.equal(response.status, 403);
    const body = (await response.json()) as ApiBody;
    assert.equal(body.error?.code, "CUSTOMER_MOBILE_REGISTRATION_VERIFICATION_REQUIRED");
  });
});

test("registration accepts a mobile number only when the grant matches the same intent and phone", async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
  const phone = testPhone(suffix);
  const phoneNormalized = normalizePhilippineMobile(phone);
  assert.ok(phoneNormalized);

  await withServer(async (baseUrl) => {
    const { intentCookie, registrationIntentHash } = await issueRegistrationIntent(baseUrl);
    const { grantCookie } = await createVerifiedRegistrationMobileGrant({
      baseUrl,
      intentCookie,
      registrationIntentHash,
      phone
    });

    const response = await fetch(`${baseUrl}/api/customer-auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${intentCookie}; ${grantCookie}`
      },
      body: JSON.stringify(registrationPayload(suffix, phone))
    });

    assert.equal(response.status, 201);
    const body = (await response.json()) as ApiBody;
    const customerId = body.data?.customer?.id;
    assert.ok(customerId);

    const customer = await prisma.customerAccount.findUnique({ where: { id: customerId } });
    assert.equal(customer?.phoneNormalized, phoneNormalized);
  });
});

test("registration rejects a verified mobile grant when the submitted phone changes", async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
  const verifiedPhone = testPhone(suffix);
  const changedPhone = testPhone(randomUUID().replaceAll("-", "").slice(0, 8));

  await withServer(async (baseUrl) => {
    const { intentCookie, registrationIntentHash } = await issueRegistrationIntent(baseUrl);
    const { grantCookie } = await createVerifiedRegistrationMobileGrant({
      baseUrl,
      intentCookie,
      registrationIntentHash,
      phone: verifiedPhone
    });

    const response = await fetch(`${baseUrl}/api/customer-auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: `${intentCookie}; ${grantCookie}`
      },
      body: JSON.stringify(registrationPayload(suffix, changedPhone))
    });

    assert.equal(response.status, 403);
    const body = (await response.json()) as ApiBody;
    assert.equal(body.error?.code, "CUSTOMER_MOBILE_REGISTRATION_VERIFICATION_REQUIRED");
  });
});

test("registration without an optional mobile number remains allowed without an OTP grant", async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8);

  await withServer(async (baseUrl) => {
    const { intentCookie } = await issueRegistrationIntent(baseUrl);
    const response = await fetch(`${baseUrl}/api/customer-auth/register`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: intentCookie
      },
      body: JSON.stringify(registrationPayload(suffix))
    });

    assert.equal(response.status, 201);
  });
});

test.after(async () => {
  if (createdCustomerEmails.length > 0) {
    const customers = await prisma.customerAccount.findMany({
      where: { email: { in: createdCustomerEmails } },
      select: { id: true }
    });
    const customerIds = customers.map((customer) => customer.id);
    if (customerIds.length > 0) {
      await prisma.customerSession.deleteMany({
        where: { customerAccountId: { in: customerIds } }
      });
      await prisma.customerAccount.deleteMany({ where: { id: { in: customerIds } } });
    }
  }

  if (createdIntentHashes.length > 0) {
    const placeholders = createdIntentHashes.map(() => "?").join(", ");
    await prisma.$executeRawUnsafe(
      `DELETE FROM customer_mobile_registration_challenges WHERE registration_intent_hash IN (${placeholders})`,
      ...createdIntentHashes
    );
  }
});
