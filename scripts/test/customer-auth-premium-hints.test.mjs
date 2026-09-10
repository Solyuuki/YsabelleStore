import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("customer auth fields provide concise premium placeholders", () => {
  const login = read("frontend/src/pages/customer/CustomerLoginPage.tsx");
  const register = read("frontend/src/pages/customer/CustomerRegisterPage.tsx");
  const css = read("frontend/src/styles/customer-auth-login-premium.css");

  assert.match(login, /placeholder="Username, email, or 09XXXXXXXXX"/);
  assert.match(login, /placeholder="Enter your password"/);

  assert.match(register, /placeholder="e\.g\. Juan Dela Cruz"/);
  assert.match(register, /placeholder="Create your username"/);
  assert.match(register, /placeholder="name@example\.com"/);
  assert.match(register, /placeholder="09XXXXXXXXX"/);
  assert.match(register, /placeholder="Create a strong password"/);
  assert.match(register, /placeholder="Re-enter your password"/);

  assert.match(
    css,
    /\.customer-auth-page--login \.customer-auth-field input::placeholder,[\s\S]*?\.customer-auth-page--register \.customer-auth-field input::placeholder\s*\{[\s\S]*?color:\s*rgb\(71 85 105 \/ 54%\);[\s\S]*?font-weight:\s*450;/
  );
});
