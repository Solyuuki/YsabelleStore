import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("customer navigation does not advertise the internal staff login", () => {
  const customerHeader = read("frontend/src/components/customer/CustomerHeader.tsx");

  assert.doesNotMatch(customerHeader, /href=["'{]+\/staff-login/);
  assert.doesNotMatch(customerHeader, /Staff\s*\/\s*Owner Login/i);
});

test("internal routes still use the dedicated staff login entry", () => {
  const appShell = read("frontend/src/app/AppShell.tsx");

  assert.match(appShell, /internalRoutePaths[\s\S]*?["']\/staff-login["']/);
  assert.match(appShell, /navigate\(["']\/staff-login["']\)/);
});
