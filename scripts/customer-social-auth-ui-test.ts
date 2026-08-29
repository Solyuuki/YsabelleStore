import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CustomerSocialAuthButtons } from "../frontend/src/components/customer/CustomerSocialAuthButtons.tsx";
import {
  buildCustomerSocialAuthStartUrl,
  type CustomerSocialAuthProvider
} from "../frontend/src/services/customerSocialAuthService.ts";

const starts: CustomerSocialAuthProvider[] = [];
const markup = renderToStaticMarkup(
  createElement(CustomerSocialAuthButtons, {
    busyProvider: null,
    onStart(provider: CustomerSocialAuthProvider) {
      starts.push(provider);
    }
  })
);

assert.match(markup, /Continue with Google/);
assert.match(markup, /Continue with Facebook/);
assert.doesNotMatch(markup, /Coming soon/i);
assert.match(markup, /type="button"/);

for (const googleBrandColor of ["#4285F4", "#34A853", "#FBBC05", "#EA4335"]) {
  assert.match(markup, new RegExp(googleBrandColor, "i"));
}
assert.match(markup, /#1877F2/i);
assert.doesNotMatch(markup, /fill="currentColor"/);

const quickSignCss = readFileSync(
  new URL("../frontend/src/styles/customer-auth-quick-sign.css", import.meta.url),
  "utf8"
);
assert.match(quickSignCss, /grid-template-columns:\s*auto\s+minmax\(0,\s*1fr\);/);
assert.match(quickSignCss, /padding:\s*0\.7rem\s+1\.35rem;/);
assert.match(quickSignCss, /text-align:\s*left;/);
assert.doesNotMatch(quickSignCss, /\.customer-social-auth__button::after\s*\{/);
assert.match(
  quickSignCss,
  /\.customer-social-auth__button\s*>\s*span:last-child\s*\{[^}]*font-weight:\s*900;[^}]*color:\s*#171a2b;/s
);

const registerSource = readFileSync(
  new URL("../frontend/src/pages/customer/CustomerRegisterPage.tsx", import.meta.url),
  "utf8"
);
const registerFormEnd = registerSource.indexOf("</form>");
const registerSocialButtons = registerSource.indexOf("<CustomerSocialAuthButtons");
assert.ok(registerFormEnd >= 0, "Register password form should exist.");
assert.ok(registerSocialButtons >= 0, "Register social actions should exist.");
assert.ok(
  registerSocialButtons > registerFormEnd,
  "Register social actions should appear after the password registration form."
);
assert.doesNotMatch(registerSource, /<span>Quick sign<\/span>/i);
assert.doesNotMatch(registerSource, /<span>or create with password<\/span>/i);

assert.equal(
  buildCustomerSocialAuthStartUrl("google", "/account", "http://localhost:3001").toString(),
  "http://localhost:3001/api/customer-auth/social/google/start?returnPath=%2Faccount"
);
assert.equal(
  buildCustomerSocialAuthStartUrl("facebook", "/", "http://localhost:3001").toString(),
  "http://localhost:3001/api/customer-auth/social/facebook/start?returnPath=%2F"
);

console.log("Customer social auth quick-sign UI contract passed.");
