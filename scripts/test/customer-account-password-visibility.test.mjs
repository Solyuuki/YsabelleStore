import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [accountPage, accountCss] = await Promise.all([
  readFile(new URL("../../frontend/src/pages/customer/CustomerAccountPage.tsx", import.meta.url), "utf8"),
  readFile(new URL("../../frontend/src/styles/customer-account.css", import.meta.url), "utf8")
]);

test("customer account security fields expose password visibility toggles", () => {
  assert.match(accountPage, /Eye,/);
  assert.match(accountPage, /EyeOff,/);
  assert.match(accountPage, /function PasswordField/);
  assert.match(accountPage, /type=\{visible \? "text" : "password"\}/);
  assert.match(accountPage, /aria-pressed=\{visible\}/);
  assert.equal((accountPage.match(/<PasswordField/g) ?? []).length, 4);
  assert.match(accountPage, /onChange=\{setRevokePassword\}/);
});

test("password visibility buttons keep input layout and button styling isolated", () => {
  assert.match(accountCss, /\.customer-account-password-field\s*\{/);
  assert.match(accountCss, /padding-right:\s*3rem/);
  assert.match(accountCss, /\.customer-account-security-card \.customer-account-password-toggle/);
  assert.match(accountCss, /transform:\s*translateY\(-50%\)/);
});
