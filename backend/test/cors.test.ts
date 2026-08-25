import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import { createApp } from "../src/app.js";

test("CORS permits browser and Electron renderer origins without using a wildcard", async () => {
  const app = createApp();
  const server = app.listen(0, "127.0.0.1");

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });

    const address = server.address() as AddressInfo;
    const endpoint = `http://127.0.0.1:${address.port}/api/storefront/categories`;

    for (const origin of ["http://localhost:5173", "http://127.0.0.1:5173", "null"]) {
      const response = await fetch(endpoint, {
        headers: {
          Origin: origin,
          "Access-Control-Request-Method": "GET"
        },
        method: "OPTIONS"
      });

      assert.equal(response.headers.get("access-control-allow-origin"), origin);
    }

    const rejected = await fetch(endpoint, {
      headers: {
        Origin: "https://untrusted.example",
        "Access-Control-Request-Method": "GET"
      },
      method: "OPTIONS"
    });

    assert.equal(rejected.headers.get("access-control-allow-origin"), null);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
