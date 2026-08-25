import assert from "node:assert/strict";

import { ApiClient } from "../frontend/src/services/apiClient.ts";
import { shouldAttachInternalBearer } from "../frontend/src/utils/internalAuthRoutes.ts";

const apiBase = "http://localhost:4000";

async function main() {
  const customerPaths = [
    "/api/storefront/products",
    "/api/storefront/orders",
    "/api/customer-auth/me",
    "/api/customer-auth/login",
    "/api/customer-account/orders"
  ];

  for (const path of customerPaths) {
    assert.equal(
      shouldAttachInternalBearer(new URL(path, apiBase)),
      false,
      `internal bearer must not be attached to ${path}`
    );
  }

  const internalPaths = ["/api/auth/me", "/api/inventory", "/api/products"];

  for (const path of internalPaths) {
    assert.equal(
      shouldAttachInternalBearer(new URL(path, apiBase)),
      true,
      `internal bearer should remain available for ${path}`
    );
  }

  const originalFetch = globalThis.fetch;
  const observedAuthorization = new Map<string, string | null>();

  globalThis.fetch = async (input, init) => {
    const url = input instanceof URL ? input : new URL(String(input));
    const headers = new Headers(init?.headers);
    observedAuthorization.set(url.pathname, headers.get("authorization"));

    return new Response(JSON.stringify({ success: true, message: "ok", data: {} }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };

  try {
    const client = new ApiClient({ baseUrl: apiBase });
    client.addRequestInterceptor((context) => {
      const headers = new Headers(context.init.headers);
      headers.set("Authorization", "Bearer internal-test-token");
      return {
        ...context,
        init: {
          ...context.init,
          headers
        }
      };
    });

    await client.request("/api/storefront/products");
    await client.request("/api/customer-auth/me");
    await client.request("/api/customer-account/orders");
    await client.request("/api/auth/me");

    assert.equal(observedAuthorization.get("/api/storefront/products"), null);
    assert.equal(observedAuthorization.get("/api/customer-auth/me"), null);
    assert.equal(observedAuthorization.get("/api/customer-account/orders"), null);
    assert.equal(observedAuthorization.get("/api/auth/me"), "Bearer internal-test-token");

    const plainHeadersClient = new ApiClient({ baseUrl: apiBase });
    plainHeadersClient.addRequestInterceptor((context) => ({
      ...context,
      init: {
        ...context.init,
        headers: { Authorization: "Bearer plain-object-token" }
      }
    }));

    await plainHeadersClient.request("/api/storefront/orders");
    assert.equal(observedAuthorization.get("/api/storefront/orders"), null);
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("Internal auth frontend boundary contract passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
