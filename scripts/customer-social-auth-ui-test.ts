import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CustomerSocialAuthButtons } from "../frontend/src/components/customer/CustomerSocialAuthButtons.tsx";
import {
  buildCustomerSocialAuthStartUrl,
  getCustomerSocialAuthNotice,
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
assert.doesNotMatch(markup, /Continue with Mobile OTP/);
assert.doesNotMatch(markup, /Available in Phase 7/);
assert.doesNotMatch(markup, /Continue with Facebook/);
assert.doesNotMatch(markup, /#1877F2/i);
assert.doesNotMatch(markup, /Coming soon/i);
assert.match(markup, /type="button"/);

for (const googleBrandColor of ["#4285F4", "#34A853", "#FBBC05", "#EA4335"]) {
  assert.match(markup, new RegExp(googleBrandColor, "i"));
}
assert.doesNotMatch(markup, /fill="currentColor"/);

const quickSignCss = readFileSync(
  new URL("../frontend/src/styles/customer-auth-quick-sign.css", import.meta.url),
  "utf8"
);
assert.match(quickSignCss, /grid-template-columns:\s*auto\s+minmax\(0,\s*1fr\);/);
assert.match(quickSignCss, /padding:\s*0\.7rem\s+1\.35rem;/);
assert.match(quickSignCss, /text-align:\s*left;/);
assert.doesNotMatch(quickSignCss, /\.customer-social-auth__button::after\s*\{/);

const premiumLabelRule = quickSignCss.match(
  /\.customer-social-auth__button\s*>\s*span:last-child\s*\{([^}]*)\}/s
);
const premiumLabelBody = premiumLabelRule?.[1];
assert.ok(premiumLabelBody, "Premium social label rule should exist.");
assert.match(premiumLabelBody, /font-weight:\s*900;/);
assert.match(premiumLabelBody, /color:\s*#171a2b;/);

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
  buildCustomerSocialAuthStartUrl(
    "google",
    "/account",
    "login",
    "http://localhost:3001"
  ).toString(),
  "http://localhost:3001/api/customer-auth/social/google/start?returnPath=%2Faccount&authPage=login"
);
assert.equal(
  getCustomerSocialAuthNotice("?social=provider_unavailable&provider=google"),
  "Google sign-in is not configured for this environment yet."
);
assert.equal(getCustomerSocialAuthNotice("?social=provider_unavailable&provider=facebook"), null);
assert.equal(getCustomerSocialAuthNotice("?social=provider_unavailable&provider=apple"), null);
assert.equal(
  getCustomerSocialAuthNotice("?social=link_required"),
  "This Google account matches an existing Ysabelle Store account. Sign in once with your existing password to link it securely."
);

const loginSource = readFileSync(
  new URL("../frontend/src/pages/customer/CustomerLoginPage.tsx", import.meta.url),
  "utf8"
);
assert.match(loginSource, /completeCustomerSocialLink/);
const passwordLoginIndex = loginSource.indexOf("await login(");
const socialLinkIndex = loginSource.indexOf("await completeCustomerSocialLink(");
const accountNavigationIndex = loginSource.indexOf('navigate("/account")');
assert.ok(
  passwordLoginIndex >= 0,
  "Password login should still be used to prove account ownership."
);
assert.ok(
  socialLinkIndex > passwordLoginIndex,
  "Pending social link should complete only after successful password login."
);
assert.ok(
  accountNavigationIndex > socialLinkIndex,
  "Successful social linking should continue to the customer account page."
);

console.log("Customer social auth quick-sign UI contract passed.");
