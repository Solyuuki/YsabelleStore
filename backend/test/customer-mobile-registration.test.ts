import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createApp } from "../src/app.js";

type ApiBody = {
  success?: boolean;
  data?: unknown;
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

function cookiePair(response: Response) {
  return (response.headers.get("set-cookie") ?? "").split(";")[0];
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
