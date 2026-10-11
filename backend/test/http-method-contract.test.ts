import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

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

test("known API paths return 405 with Allow when the HTTP method is unsupported", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/health`, { method: "POST" });
    const body = (await response.json()) as {
      success?: boolean;
      error?: { code?: string; details?: { allowedMethods?: string[] } };
    };

    assert.equal(response.status, 405);
    assert.equal(body.success, false);
    assert.equal(body.error?.code, "METHOD_NOT_ALLOWED");
    assert.equal(response.headers.get("allow"), "GET, HEAD");
    assert.deepEqual(body.error?.details?.allowedMethods, ["GET", "HEAD"]);
  });
});

test("unknown API paths remain 404 instead of being mislabeled as method errors", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/definitely-not-a-route`, { method: "POST" });
    const body = (await response.json()) as { error?: { code?: string } };

    assert.equal(response.status, 404);
    assert.equal(body.error?.code, "NOT_FOUND");
  });
});

test("route parameters still participate in method detection", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/storefront/products/example-product`, {
      method: "DELETE"
    });

    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "GET, HEAD");
  });
});
