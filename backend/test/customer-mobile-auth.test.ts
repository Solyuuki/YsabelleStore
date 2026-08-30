import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createApp } from "../src/app.js";

type ApiBody = {
  success?: boolean;
  message?: string;
  data?: unknown;
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

async function json(response: Response): Promise<ApiBody> {
  return (await response.json()) as ApiBody;
}

test("mobile quick sign request accepts a PH mobile number with a privacy-safe response", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/customer-auth/mobile/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: "09171234567" })
    });

    assert.equal(response.status, 200);
    const body = await json(response);
    assert.equal(body.success, true);
    assert.equal(body.data, undefined);
    assert.equal(JSON.stringify(body).includes("09171234567"), false);
  });
});
