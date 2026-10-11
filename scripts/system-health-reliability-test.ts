import assert from "node:assert/strict";

import {
  classifyHealthFailure,
  classifyHealthResponse
} from "../frontend/src/services/systemHealthService";
import {
  assertSystemMutationAllowed,
  getSystemMutationGate,
  isMutationMethod,
  setSystemMutationGate,
  SystemMutationBlockedError
} from "../frontend/src/services/systemReliabilityGate";

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

assert.equal(isMutationMethod("POST"), true);
assert.equal(isMutationMethod("PATCH"), true);
assert.equal(isMutationMethod("DELETE"), true);
assert.equal(isMutationMethod("GET"), false);

setSystemMutationGate(true, "unavailable");
assert.equal(getSystemMutationGate().blocked, true);
assert.throws(
  () => assertSystemMutationAllowed("POST"),
  (error: unknown) =>
    error instanceof SystemMutationBlockedError && error.code === "SYSTEM_MUTATION_BLOCKED"
);
assert.doesNotThrow(() => assertSystemMutationAllowed("GET"));

setSystemMutationGate(false, null);
assert.equal(getSystemMutationGate().blocked, false);
assert.doesNotThrow(() => assertSystemMutationAllowed("POST"));

console.log("Sprint 11 frontend reliability-state contract passed.");
