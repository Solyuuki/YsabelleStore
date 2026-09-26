// Sprint 11 canonical full-screen status UI regression contract.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const statusScreenSource = source("src/components/shared/StatusScreen.tsx");
const authScreenSource = source("src/components/shared/GlobalAuthenticationStatusScreen.tsx");
const reliabilitySource = source("src/components/shared/GlobalReliabilityUI.tsx");
const reliabilityContextSource = source("src/context/SystemReliabilityContext.tsx");
const accessDeniedSource = source("src/pages/AccessDeniedPage.tsx");
const notFoundSource = source("src/pages/NotFoundPage.tsx");
const customerNotFoundSource = source("src/pages/customer/CustomerNotFoundPage.tsx");
const apiClientSource = source("src/services/apiClient.ts");
const internalRoutesSource = source("src/utils/internalAuthRoutes.ts");

assert.match(statusScreenSource, /createPortal/);
assert.match(statusScreenSource, /data-status-overlay-lock-count/);
assert.match(statusScreenSource, /data-status-variant/);
assert.match(statusScreenSource, /BrandLogo/);
assert.match(statusScreenSource, /variant === "auth"/);
assert.match(statusScreenSource, /variant === "navigation"/);
assert.match(statusScreenSource, /variant === "system"/);
assert.doesNotMatch(statusScreenSource, /reliability-ring/);
assert.doesNotMatch(statusScreenSource, /reliability-eyebrow__dot/);

assert.match(authScreenSource, /statusLabel="401"/);
assert.match(authScreenSource, /variant="auth"/);
assert.match(authScreenSource, /hadAuthorization/);
assert.match(authScreenSource, /isCustomerProtectedRoute/);
assert.match(authScreenSource, /Your session has expired/);
assert.doesNotMatch(authScreenSource, /noteDescription=/);

assert.match(accessDeniedSource, /statusLabel="403"/);
assert.match(accessDeniedSource, /variant="auth"/);
assert.doesNotMatch(accessDeniedSource, /noteDescription=/);

assert.match(notFoundSource, /statusLabel="404"/);
assert.match(notFoundSource, /variant="navigation"/);
assert.doesNotMatch(notFoundSource, /noteDescription=/);

assert.match(customerNotFoundSource, /statusLabel="404"/);
assert.match(customerNotFoundSource, /variant="navigation"/);
assert.doesNotMatch(customerNotFoundSource, /noteDescription=/);

assert.match(reliabilityContextSource, /detail\?\.status !== 503/);
assert.match(reliabilityContextSource, /setLastHttpStatus\(503\)/);
assert.match(reliabilitySource, /statusLabel: "503"/);
assert.match(reliabilitySource, /statusLabel: "OFFLINE"/);
assert.match(reliabilitySource, /statusLabel: "DATABASE"/);
assert.match(reliabilitySource, /statusLabel: "TIMEOUT"/);
assert.match(reliabilitySource, /variant="system"/);

assert.match(apiClientSource, /hadAuthorization/);
assert.match(apiClientSource, /path: context\.url\.pathname/);
assert.match(apiClientSource, /method: \(context\.init\.method \?\? "GET"\)\.toUpperCase\(\)/);

assert.match(internalRoutesSource, /"\/receiving"/);

console.log("Sprint 11 full-screen HTTP and reliability UI contract passed.");
