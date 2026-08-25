import assert from "node:assert/strict";

import {
  classifyHealthFailure,
  classifyHealthResponse
} from "../frontend/src/services/systemHealthService";

assert.equal(
  classifyHealthResponse({
    status: "healthy",
    checks: { database: "connected" },
    configuration: { databaseUrlLoaded: true, jwtSecretLoaded: true }
  }),
  "healthy"
);

assert.equal(
  classifyHealthResponse({
    status: "degraded",
    checks: { database: "connected" },
    configuration: { databaseUrlLoaded: true, jwtSecretLoaded: false }
  }),
  "degraded"
);

assert.equal(
  classifyHealthResponse({
    status: "unavailable",
    checks: { database: "not_configured" },
    configuration: { databaseUrlLoaded: false, jwtSecretLoaded: true }
  }),
  "database-unavailable"
);

const abortError = new Error("timed out");
abortError.name = "AbortError";
assert.equal(classifyHealthFailure(abortError, true), "timeout");
assert.equal(classifyHealthFailure(new TypeError("fetch failed"), false), "offline");
assert.equal(classifyHealthFailure(new TypeError("fetch failed"), true), "backend-unavailable");

console.log("Sprint 8 frontend reliability-state contract passed.");
