import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createApp } from "../src/app.js";

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

async function postInvalidLogin(baseUrl: string, origin?: string) {
  return fetch(`${baseUrl}/api/customer-auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(origin ? { Origin: origin } : {})
    },
    body: JSON.stringify({
      identifier: "origin-cache-missing@example.com",
      password: "WrongPassword123!"
    })
  });
}

function assertSensitiveNoStore(response: Response) {
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("pragma"), "no-cache");
}

test("approved browser Origin and non-browser requests can reach customer auth behavior", async () => {
  await withServer(async (baseUrl) => {
    const approved = await postInvalidLogin(baseUrl, "http://localhost:5173");
    const noOrigin = await postInvalidLogin(baseUrl);

    assert.equal(approved.status, 401);
    assert.equal(noOrigin.status, 401);
  });
});

test("unapproved browser Origin is rejected before state-changing customer auth behavior", async () => {
  await withServer(async (baseUrl) => {
    const login = await postInvalidLogin(baseUrl, "https://evil.example");
    const loginBody = (await login.json()) as {
      success?: boolean;
      error?: { code?: string };
    };

    assert.equal(login.status, 403);
    assert.equal(loginBody.success, false);
    assert.equal(loginBody.error?.code, "CUSTOMER_AUTH_ORIGIN_REJECTED");

    const intent = await fetch(`${baseUrl}/api/customer-auth/registration-intent`, {
      headers: { Origin: "https://evil.example" }
    });
    const intentBody = (await intent.json()) as {
      success?: boolean;
      error?: { code?: string };
    };

    assert.equal(intent.status, 403);
    assert.equal(intentBody.error?.code, "CUSTOMER_AUTH_ORIGIN_REJECTED");
    assert.equal(intent.headers.get("set-cookie"), null);

    const logout = await fetch(`${baseUrl}/api/customer-auth/logout`, {
      method: "POST",
      headers: { Origin: "https://evil.example" }
    });
    const logoutBody = (await logout.json()) as {
      success?: boolean;
      error?: { code?: string };
    };

    assert.equal(logout.status, 403);
    assert.equal(logoutBody.error?.code, "CUSTOMER_AUTH_ORIGIN_REJECTED");
  });
});

test("customer auth and customer account responses are explicitly non-cacheable", async () => {
  await withServer(async (baseUrl) => {
    const me = await fetch(`${baseUrl}/api/customer-auth/me`);
    const login = await postInvalidLogin(baseUrl);
    const intent = await fetch(`${baseUrl}/api/customer-auth/registration-intent`);
    const accountOrders = await fetch(`${baseUrl}/api/customer-account/orders`);

    assert.equal(me.status, 401);
    assert.equal(login.status, 401);
    assert.equal(intent.status, 200);
    assert.equal(accountOrders.status, 401);

    assertSensitiveNoStore(me);
    assertSensitiveNoStore(login);
    assertSensitiveNoStore(intent);
    assertSensitiveNoStore(accountOrders);
  });
});
