import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("register auth uses a dense desktop layout without changing mobile flow", () => {
  const register = read("frontend/src/pages/customer/CustomerRegisterPage.tsx");
  const authCss = read("frontend/src/styles/customer-auth-phase3.css");

  assert.match(register, /customer-auth-card customer-auth-card--register/);
  assert.match(register, /customer-auth-form customer-auth-form--register/);

  assert.match(
    authCss,
    /\.customer-auth-stage__panel \.customer-auth-card--register\s*\{[\s\S]*?width:\s*min\(100%,\s*44rem\);/
  );
  assert.match(
    authCss,
    /\.customer-auth-stage__panel \.customer-auth-form--register\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/
  );
  assert.match(
    authCss,
    /\.customer-auth-stage__panel \.customer-auth-form--register\s*>\s*\.customer-auth-submit\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1;/
  );
  assert.match(
    authCss,
    /@media\s*\(max-width:\s*960px\)[\s\S]*?\.customer-auth-stage__panel \.customer-auth-form--register\s*\{[\s\S]*?grid-template-columns:\s*1fr;/
  );
});
