import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("login always opens with manual and quick sign methods, not saved email accounts", () => {
  const source = read("frontend/src/pages/customer/CustomerLoginPage.tsx");

  assert.doesNotMatch(source, /showManualLogin/);
  assert.doesNotMatch(source, /Back to known accounts/);
  assert.match(
    source,
    /quickSignPanel === null[\s\S]*?<form[\s\S]*?customer-login-identifier[\s\S]*?<CustomerSocialAuthButtons/
  );
  assert.match(source, /emailLabel="Email Quick Sign"/);
  assert.match(source, /onEmailStart=\{\(\) => void handleEmailQuickSignStart\(\)\}/);
});

test("saved email accounts are loaded only inside Email Quick Sign", () => {
  const source = read("frontend/src/pages/customer/CustomerLoginPage.tsx");
  const knownAccounts = read("frontend/src/components/customer/CustomerKnownAccounts.tsx");

  assert.match(
    source,
    /async function handleEmailQuickSignStart\(\)[\s\S]*?getCustomerRememberedAccounts\(\)[\s\S]*?setQuickSignPanel\(accounts\.length > 0 \? "email-saved" : "email-entry"\)/
  );
  assert.match(
    source,
    /quickSignPanel === "email-saved"[\s\S]*?<CustomerKnownAccounts[\s\S]*?onUseAnotherAccount=\{\(\) => setQuickSignPanel\("email-entry"\)\}/
  );
  assert.match(
    source,
    /quickSignPanel === "email-entry"[\s\S]*?<CustomerEmailAuthPanel/
  );
  assert.match(knownAccounts, /Use another email/);
  assert.doesNotMatch(knownAccounts, />Use another account</);
});

test("Email Quick Sign can return directly to the main login methods", () => {
  const source = read("frontend/src/pages/customer/CustomerLoginPage.tsx");

  assert.match(
    source,
    /quickSignPanel === "email-saved"[\s\S]*?Other sign-in methods[\s\S]*?setQuickSignPanel\(null\)/
  );
  assert.match(
    source,
    /<CustomerEmailAuthPanel[\s\S]*?onCancel=\{\(\) => setQuickSignPanel\(null\)\}/
  );
});
