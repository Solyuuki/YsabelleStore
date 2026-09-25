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
assert.match(statusScreenSource, /reliability-overlay/);
assert.match(statusScreenSource, /EmptyTitle/);
assert.match(statusScreenSource, /EmptyDescription/);

assert.match(authScreenSource, /HTTP 401/);
assert.match(authScreenSource, /hadAuthorization/);
assert.match(authScreenSource, /isCustomerProtectedRoute/);
assert.match(authScreenSource, /Your session has expired/);

assert.match(accessDeniedSource, /HTTP 403/);
assert.match(accessDeniedSource, /StatusScreen/);
assert.match(notFoundSource, /HTTP 404/);
assert.match(customerNotFoundSource, /HTTP 404/);

assert.match(reliabilityContextSource, /detail\?\.status !== 503/);
assert.match(reliabilityContextSource, /setLastHttpStatus\(503\)/);
assert.match(reliabilitySource, /HTTP 503/);
assert.match(reliabilitySource, /OFFLINE/);
assert.match(reliabilitySource, /DATABASE/);
assert.match(reliabilitySource, /TIMEOUT/);

assert.match(apiClientSource, /hadAuthorization/);
assert.match(apiClientSource, /path: context\.url\.pathname/);
assert.match(apiClientSource, /method: \(context\.init\.method \?\? "GET"\)\.toUpperCase\(\)/);

assert.match(internalRoutesSource, /"\/receiving"/);

console.log("Sprint 11 full-screen HTTP and reliability UI contract passed.");
