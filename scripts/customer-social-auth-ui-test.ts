import assert from "node:assert/strict";
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

assert.equal(
  buildCustomerSocialAuthStartUrl("google", "/account", "http://localhost:3001").toString(),
  "http://localhost:3001/api/customer-auth/social/google/start?returnPath=%2Faccount"
);
assert.equal(
  buildCustomerSocialAuthStartUrl("facebook", "/", "http://localhost:3001").toString(),
  "http://localhost:3001/api/customer-auth/social/facebook/start?returnPath=%2F"
);

console.log("Customer social auth quick-sign UI contract passed.");
