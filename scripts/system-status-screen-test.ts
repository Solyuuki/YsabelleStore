import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const statusScreenSource = source("src/components/shared/SystemStatusScreen.tsx");
const notifierSource = source("src/components/shared/GlobalHttpStatusNotifier.tsx");
const reliabilityUiSource = source("src/components/shared/GlobalReliabilityUI.tsx");
const reliabilityContextSource = source("src/context/SystemReliabilityContext.tsx");
const appShellSource = source("src/app/AppShell.tsx");
const customerAppSource = source("src/app/CustomerApp.tsx");
const sessionRequiredSource = source("src/pages/SessionRequiredPage.tsx");
const accessDeniedSource = source("src/pages/AccessDeniedPage.tsx");
const notFoundSource = source("src/pages/NotFoundPage.tsx");
const customerNotFoundSource = source("src/pages/customer/CustomerNotFoundPage.tsx");

assert.match(statusScreenSource, /reliability-overlay/);
assert.match(statusScreenSource, /reliability-card/);
assert.match(statusScreenSource, /aria-labelledby/);
assert.match(statusScreenSource, /aria-describedby/);
assert.match(statusScreenSource, /aria-modal="true"/);

assert.match(sessionRequiredSource, /code="401"/);
assert.match(sessionRequiredSource, /Sign in required/);
assert.match(accessDeniedSource, /code="403"/);
assert.match(accessDeniedSource, /Access denied/);
assert.match(notFoundSource, /code="404"/);
assert.match(customerNotFoundSource, /code="404"/);

assert.match(appShellSource, /<SessionRequiredPage onSignIn=/);
assert.match(appShellSource, /<AccessDeniedPage moduleName=/);
assert.match(appShellSource, /<NotFoundPage onNavigate=/);
assert.doesNotMatch(
  appShellSource,
  /status === "unauthenticated" && internalRoutePaths\.has\(path\)[\s\S]{0,180}navigate\("\/staff-login"\);/,
  "Protected internal routes must present the 401 status surface before sign-in navigation."
);

assert.match(
  customerAppSource,
  /const sessionRequired = protectedRoute && status === "unauthenticated"/
);
assert.match(customerAppSource, /<SessionRequiredPage[\s\S]*?audience="customer"/);
assert.match(customerAppSource, /return \([\s\S]*?<CustomerNotFoundPage navigate=\{navigate\}/);

assert.match(reliabilityContextSource, /detail\?\.status === 503/);
assert.match(reliabilityContextSource, /setHttpStatus\(503\)/);
assert.match(reliabilityUiSource, /code=\{httpStatus === 503 \? "503" : undefined\}/);

assert.match(
  notifierSource,
  /new Set\(\[405, 409, 413, 415, 429, 500, 502, 504\]\)/,
  "Approved action-level HTTP errors must remain notification toasts."
);
assert.doesNotMatch(notifierSource, /new Set\(\[[^\]]*503/);

console.log("Sprint 11 canonical system-status UI contract passed.");
