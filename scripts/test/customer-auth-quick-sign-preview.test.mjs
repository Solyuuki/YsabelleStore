import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const fileUrl = (path) => new URL(`../../${path}`, import.meta.url);
const read = (path) => readFileSync(fileUrl(path), "utf8");

test("customer login exposes a premium UI-only Quick Sign preview", () => {
  const login = read("frontend/src/pages/customer/CustomerLoginPage.tsx");
  const css = read("frontend/src/styles/customer-auth-login-premium.css");

  assert.match(login, /ShieldCheck/);
  assert.match(login, /className="customer-auth-quick-divider"/);
  assert.match(login, /className="customer-auth-quick-sign" aria-disabled="true"/);
  assert.match(login, />Quick Sign</);
  assert.match(login, />Trusted account access</);
  assert.match(login, />Coming soon</);
  assert.doesNotMatch(login, /customer-auth-quick-sign[^>]*onClick=/);

  assert.match(
    css,
    /\.customer-auth-page--login \.customer-auth-quick-sign\s*\{[\s\S]*?display:\s*grid;[\s\S]*?grid-template-columns:\s*auto 1fr auto;[\s\S]*?backdrop-filter:\s*blur\(18px\) saturate\(135%\);/
  );
  assert.match(
    css,
    /\.customer-auth-page--login \.customer-auth-quick-sign__status\s*\{[\s\S]*?border-radius:\s*999px;[\s\S]*?text-transform:\s*uppercase;/
  );
});
