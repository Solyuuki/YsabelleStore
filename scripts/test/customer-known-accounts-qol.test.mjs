import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("saved email accounts use compact capacity and card-first continue UX", () => {
  const component = read("frontend/src/components/customer/CustomerKnownAccounts.tsx");
  const css = read("frontend/src/styles/customer-known-accounts.css");

  assert.match(component, /Email Quick Sign/i);
  assert.match(component, /Saved email accounts/);
  assert.match(component, /\{accounts\.length\}\/\{maxAccounts\}/);
  assert.doesNotMatch(component, /Continue on this browser without another code/);
  assert.doesNotMatch(component, /className="customer-known-account__continue"/);
  assert.match(component, /className="customer-known-account__select"/);
  assert.match(component, /onClick=\{\(\) => void handleContinue\(account\)\}/);
  assert.match(css, /\.customer-known-account__select\s*\{/);
  assert.match(css, /\.customer-known-accounts__capacity\s*\{/);
});

test("saved email account actions use an inline overflow action with forget only", () => {
  const component = read("frontend/src/components/customer/CustomerKnownAccounts.tsx");
  const css = read("frontend/src/styles/customer-known-accounts.css");

  assert.match(component, /MoreVertical/);
  assert.match(component, /aria-haspopup="menu"/);
  assert.match(component, /aria-expanded=\{menuOpen\}/);
  assert.match(component, /role="menu"/);
  assert.match(component, /role="menuitem"/);
  assert.match(component, /<span>Forget<\/span>/);
  assert.doesNotMatch(component, /Forget account/);
  assert.match(component, /event\.key === "Escape"/);
  assert.match(component, /data-known-account-menu/);
  assert.match(css, /\.customer-known-account__menu\s*\{[\s\S]*?position:\s*static;/);
  assert.doesNotMatch(css, /\.customer-known-account__menu\s*\{[\s\S]*?top:/);
  assert.match(css, /\.customer-known-account__menu-wrap\s*\{[\s\S]*?display:\s*flex;/);
});

test("trusted saved email accounts show remaining trust days", () => {
  const component = read("frontend/src/components/customer/CustomerKnownAccounts.tsx");

  assert.match(component, /days left/);
  assert.match(component, /1 day left/);
  assert.doesNotMatch(component, /Trusted until/);
});
