import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("customer auth routes use the storefront auth frame without changing auth contracts", () => {
  const framePath = "frontend/src/components/customer/CustomerAuthFrame.tsx";
  assert.equal(existsSync(fileUrl(framePath)), true, "customer auth frame must exist");

  const frame = read(framePath);
  const login = read("frontend/src/pages/customer/CustomerLoginPage.tsx");
  const register = read("frontend/src/pages/customer/CustomerRegisterPage.tsx");

  assert.match(frame, /YsabelleBrandMark/);
  assert.match(frame, /customer-auth-stage__brand/);
  assert.match(frame, /customer-auth-stage__panel/);

  assert.match(login, /CustomerAuthFrame/);
  assert.match(login, /login\(\{ identifier: identifier\.trim\(\), password \}\)/);
  assert.match(login, /navigate\("\/account"\)/);

  assert.match(register, /CustomerAuthFrame/);
  assert.match(register, /prepareCustomerRegistrationIntent/);
  assert.match(
    register,
    /register\(\{\s*email: email\.trim\(\),\s*name: name\.trim\(\),\s*password,\s*phone: phone\.trim\(\) \|\| undefined,\s*username: username\.trim\(\)\s*\}\)/
  );
  assert.match(register, /navigate\("\/account"\)/);
});

test("customer auth fields expose accessible errors and password state", () => {
  const login = read("frontend/src/pages/customer/CustomerLoginPage.tsx");
  const register = read("frontend/src/pages/customer/CustomerRegisterPage.tsx");

  assert.match(login, /aria-describedby=\{fieldErrors\.identifier/);
  assert.match(login, /aria-describedby=\{fieldErrors\.password/);
  assert.match(login, /aria-pressed=\{showPassword\}/);
  assert.match(login, /aria-busy=\{submitting\}/);

  assert.match(register, /aria-describedby=\{fieldErrors\.name/);
  assert.match(register, /aria-describedby=\{fieldErrors\.username/);
  assert.match(register, /aria-describedby=\{fieldErrors\.email/);
  assert.match(register, /aria-describedby=\{fieldErrors\.phone/);
  assert.match(register, /aria-describedby=\{fieldErrors\.password/);
  assert.match(register, /aria-describedby=\{\s*fieldErrors\.confirmPassword/);
  assert.match(register, /aria-pressed=\{showPassword\}/);
  assert.match(register, /aria-pressed=\{showConfirmPassword\}/);
  assert.match(register, /aria-busy=\{submitting\}/);
});

test("customer auth redesign stays inside the blue purple pink storefront palette", () => {
  const authCss = read("frontend/src/styles/customer-auth-phase3.css");

  assert.match(authCss, /\.customer-auth-stage\s*\{/);
  assert.match(authCss, /\.customer-auth-stage__brand\s*\{/);
  assert.match(authCss, /\.customer-auth-stage__panel\s*\{/);
  assert.match(authCss, /var\(--customer-info\)/);
  assert.match(authCss, /var\(--customer-primary\)/);
  assert.match(authCss, /var\(--customer-accent\)/);
  assert.doesNotMatch(authCss, /emerald|#10b981|#059669|#047857/i);
});
