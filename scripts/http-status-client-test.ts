import assert from "node:assert/strict";

import { ApiClient } from "../frontend/src/services/apiClient";

async function main() {
  const originalFetch = globalThis.fetch;
  const client = new ApiClient({ baseUrl: "http://status-contract.test" });

  try {
    globalThis.fetch = async () => new Response(null, { status: 204 });

    const noContent = await client.request("/resource", { method: "DELETE" });
    assert.equal(noContent.success, true);
    assert.equal(noContent.httpStatus, 204);
    assert.equal(noContent.message, "Request completed successfully.");

    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          success: false,
          message: "Too many authentication attempts.",
          error: { code: "AUTH_RATE_LIMITED" }
        }),
        {
          status: 429,
          headers: {
            "content-type": "application/json",
            "retry-after": "7"
          }
        }
      );

    const rateLimited = await client.request("/login", { method: "POST" });
    assert.equal(rateLimited.success, false);
    assert.equal(rateLimited.httpStatus, 429);
    assert.equal(rateLimited.retryAfterSeconds, 7);

    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          success: false,
          message: "A required service returned an invalid response.",
          error: { code: "BAD_GATEWAY" }
        }),
        {
          status: 502,
          headers: { "content-type": "application/json" }
        }
      );

    const upstreamFailure = await client.request("/forecast");
    assert.equal(upstreamFailure.success, false);
    assert.equal(upstreamFailure.httpStatus, 502);
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("Frontend HTTP transport status contract passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
