import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("saved email accounts remain the default login view without a back pseudo-route", () => {
  const source = read("frontend/src/pages/customer/CustomerLoginPage.tsx");

  assert.doesNotMatch(source, /Back to known accounts/);
  assert.doesNotMatch(source, /customer-known-accounts__back-link/);
  assert.match(source, /rememberedAccounts\.length > 0[\s\S]*?<CustomerKnownAccounts/);
  assert.match(source, /onUseAnotherAccount=\{\(\) =>[\s\S]*?setShowManualLogin\(true\)/);
  assert.match(source, /showManualLogin \|\| rememberedAccounts\.length === 0/);
});

test("revealing another login method keeps saved email accounts in the same login screen", () => {
  const source = read("frontend/src/pages/customer/CustomerLoginPage.tsx");

  assert.doesNotMatch(source, /const showKnownAccounts/);
  assert.match(
    source,
    /quickSignPanel === null[\s\S]*?rememberedAccounts\.length > 0[\s\S]*?<CustomerKnownAccounts[\s\S]*?showManualLogin \|\| rememberedAccounts\.length === 0/
  );
});
