import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("internal session restore toast is scoped to internal routes", () => {
  const authContext = read("frontend/src/context/AuthContext.tsx");
  const appShell = read("frontend/src/app/AppShell.tsx");
  const internalRoutes = read("frontend/src/utils/internalAuthRoutes.ts");

  assert.match(internalRoutes, /export function isInternalAppRoutePath\(/);
  assert.match(internalRoutes, /["']\/staff-login["']/);
  assert.match(internalRoutes, /["']\/dashboard["']/);
  assert.doesNotMatch(internalRoutes, /["']\/login["']/);
  assert.doesNotMatch(internalRoutes, /["']\/account["']/);

  assert.match(authContext, /isInternalAppRoutePath\(window\.location\.pathname\)/);
  assert.match(appShell, /isInternalAppRoutePath\(path\)/);
});
