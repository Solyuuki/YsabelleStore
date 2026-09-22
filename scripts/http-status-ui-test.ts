import assert from "node:assert/strict";

import { resolveHttpStatusUi } from "../frontend/src/services/httpStatusUi";

const expectedCategories = new Map<number, string>([
  [200, "success"],
  [201, "success"],
  [202, "success"],
  [204, "success"],
  [400, "request-error"],
  [401, "authentication"],
  [403, "authorization"],
  [404, "not-found"],
  [405, "method-not-allowed"],
  [409, "conflict"],
  [413, "payload-too-large"],
  [415, "unsupported-media"],
  [422, "validation"],
  [429, "rate-limited"],
  [500, "server-error"],
  [502, "upstream-error"],
  [503, "service-unavailable"],
  [504, "gateway-timeout"]
]);

for (const [status, category] of expectedCategories) {
  assert.equal(resolveHttpStatusUi(status).category, category);
}

assert.equal(resolveHttpStatusUi(401).blocking, true);
assert.equal(resolveHttpStatusUi(403).blocking, true);
assert.equal(resolveHttpStatusUi(503).blocking, true);
assert.equal(resolveHttpStatusUi(409).retryable, true);
assert.equal(resolveHttpStatusUi(500).retryable, true);
assert.equal(resolveHttpStatusUi(502).retryable, true);
assert.equal(resolveHttpStatusUi(504).retryable, true);

const throttled = resolveHttpStatusUi(429, { retryAfterSeconds: 12 });
assert.match(throttled.message, /12 seconds/);
assert.equal(throttled.severity, "warning");

const serverMessage = resolveHttpStatusUi(422, {
  message: "Delivery address is incomplete."
});
assert.equal(serverMessage.message, "Delivery address is incomplete.");

console.log("Sprint 11 HTTP status UI contract passed.");
