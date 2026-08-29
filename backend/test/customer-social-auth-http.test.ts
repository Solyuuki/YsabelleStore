import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createApp } from "../src/app.js";

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

async function body(response: Response) {
  return (await response.json()) as ApiBody;
}

test("social provider start fails closed with no-store response when provider credentials are absent", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/customer-auth/social/google/start`, {
      redirect: "manual"
    });
    assert.equal(response.status, 503);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/i);
    const payload = await body(response);
    assert.equal(payload.error?.code, "SOCIAL_AUTH_PROVIDER_UNAVAILABLE");
    assert.equal(JSON.stringify(payload).includes("secret"), false);
  });
});

test("unknown social provider is rejected without starting an oauth transaction", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/customer-auth/social/apple/start`, {
      redirect: "manual"
    });
    assert.equal(response.status, 400);
    const payload = await body(response);
    assert.equal(payload.error?.code, "SOCIAL_AUTH_PROVIDER_UNAVAILABLE");
  });
});

test("invalid provider callback redirects only to a sanitized customer login status", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(
      `${baseUrl}/api/customer-auth/social/google/callback?state=invalid-state&code=provider-code`,
      { redirect: "manual" }
    );
    assert.equal(response.status, 302);
    const location = response.headers.get("location") ?? "";
    assert.equal(location, "http://localhost:5173/login?social=invalid_callback");
    assert.equal(location.includes("provider-code"), false);
    assert.equal(location.includes("invalid-state"), false);
  });
});

test("social link completion is CUSTOMER-session protected", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/customer-auth/social/link/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}"
    });
    assert.equal(response.status, 401);
    const payload = await body(response);
    assert.equal(payload.error?.code, "CUSTOMER_SESSION_REQUIRED");
  });
});

test("Electron oauth start fails closed without provider credentials and handoff redemption rejects unknown code", async () => {
  await withServer(async (baseUrl) => {
    const start = await fetch(`${baseUrl}/api/customer-auth/social/electron/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: "GOOGLE",
        verifierChallenge: "A".repeat(43)
      })
    });
    assert.equal(start.status, 503);
    assert.equal((await body(start)).error?.code, "SOCIAL_AUTH_PROVIDER_UNAVAILABLE");

    const redeem = await fetch(`${baseUrl}/api/customer-auth/social/electron/redeem`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "unknown-code-value", verifier: "unknown-verifier-value" })
    });
    assert.equal(redeem.status, 400);
    assert.equal((await body(redeem)).error?.code, "SOCIAL_AUTH_HANDOFF_INVALID");
  });
});
