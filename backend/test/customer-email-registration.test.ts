import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createApp } from "../src/app.js";
import { prisma } from "../src/database/prismaClient.js";

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
  return (response.headers.get("set-cookie") ?? "").split(";", 1)[0]!;
}

test("customer accounts persist explicit email and mobile verification timestamps", async () => {
  const account = await prisma.customerAccount.findFirst({
    select: {
      emailVerifiedAt: true,
      phoneVerifiedAt: true
    }
  });

  assert.ok(account === null || "emailVerifiedAt" in account);
  assert.ok(account === null || "phoneVerifiedAt" in account);
});

test("registration email OTP uses its dedicated persisted challenge model", () => {
  assert.ok(prisma.customerEmailRegistrationChallenge);
});

test("registration can request a privacy-safe email verification code", async () => {
  await withServer(async (baseUrl) => {
    const intentResponse = await fetch(`${baseUrl}/api/customer-auth/registration-intent`);
    assert.equal(intentResponse.status, 200);
    const intentCookie = cookiePair(intentResponse);
    assert.ok(intentCookie);

    await new Promise((resolve) => setTimeout(resolve, 800));

    const response = await fetch(`${baseUrl}/api/customer-auth/registration/email/request`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: intentCookie
      },
      body: JSON.stringify({ email: "new.customer@example.com" })
    });

    assert.equal(response.status, 200);
    const bodyText = await response.text();
    assert.equal(bodyText.includes("new.customer@example.com"), false);
  });
});
