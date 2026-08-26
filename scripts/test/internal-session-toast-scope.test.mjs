import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("internal auth toasts stay inside internal app routes", () => {
  const notificationStack = read("frontend/src/components/shared/NotificationStack.tsx");
  const internalRoutes = read("frontend/src/utils/internalAuthRoutes.ts");

  assert.match(internalRoutes, /export function isInternalAppRoutePath\(/);
  assert.match(internalRoutes, /["']\/staff-login["']/);
  assert.match(internalRoutes, /["']\/dashboard["']/);
  assert.doesNotMatch(internalRoutes, /["']\/login["']/);
  assert.doesNotMatch(internalRoutes, /["']\/account["']/);

  assert.match(notificationStack, /isInternalAppRoutePath\(window\.location\.pathname\)/);
  assert.match(notificationStack, /toasts\.filter\(\(toast\) => toast\.scope !== ["']auth["']\)/);
});
