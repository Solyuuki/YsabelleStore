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
assert.match(
  quickSignCss,
  /grid-template-columns:\s*2\.25rem\s+minmax\(0,\s*1fr\)\s+2\.25rem;/
);
assert.match(quickSignCss, /\.customer-social-auth__button::after\s*\{/);
assert.match(quickSignCss, /text-align:\s*center;/);

assert.equal(
  buildCustomerSocialAuthStartUrl("google", "/account", "http://localhost:3001").toString(),
  "http://localhost:3001/api/customer-auth/social/google/start?returnPath=%2Faccount"
);
assert.equal(
  buildCustomerSocialAuthStartUrl("facebook", "/", "http://localhost:3001").toString(),
  "http://localhost:3001/api/customer-auth/social/facebook/start?returnPath=%2F"
);

console.log("Customer social auth quick-sign UI contract passed.");
