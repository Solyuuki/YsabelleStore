import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  getCustomerAuthPageKind,
  resolveCustomerAuthRedirect
} from "../frontend/src/utils/customerRoutes.ts";
import { resolveCustomerAuthStatus } from "../frontend/src/context/customerAuthState.ts";

assert.equal(getCustomerAuthPageKind("/login"), "login");
assert.equal(getCustomerAuthPageKind("/register"), "register");
assert.equal(getCustomerAuthPageKind("/account"), "account");
assert.equal(getCustomerAuthPageKind("/shop"), null);

assert.equal(resolveCustomerAuthRedirect("/account", "unauthenticated"), "/login");
assert.equal(resolveCustomerAuthRedirect("/login", "authenticated"), "/");
assert.equal(resolveCustomerAuthRedirect("/register", "authenticated"), "/");
assert.equal(resolveCustomerAuthRedirect("/shop", "unauthenticated"), null);
assert.equal(resolveCustomerAuthRedirect("/checkout", "unauthenticated"), null);
assert.equal(resolveCustomerAuthRedirect("/account", "loading"), null);

assert.equal(resolveCustomerAuthStatus(null, true), "loading");
assert.equal(resolveCustomerAuthStatus(null, false), "unauthenticated");
assert.equal(
  resolveCustomerAuthStatus(
    {
      id: "customer-1",
      name: "Maria Customer",
      username: null,
      email: "maria@example.com",
      phone: null,
      status: "ACTIVE"
    },
    false
  ),
  "authenticated"
);

const loginSource = readFileSync(
  resolve(process.cwd(), "src/pages/customer/CustomerLoginPage.tsx"),
  "utf8"
);
const registerSource = readFileSync(
  resolve(process.cwd(), "src/pages/customer/CustomerRegisterPage.tsx"),
  "utf8"
);
const registrationMobilePanelSource = readFileSync(
  resolve(process.cwd(), "src/components/customer/CustomerMobileRegistrationPanel.tsx"),
  "utf8"
);
const emailAuthPanelSource = readFileSync(
  resolve(process.cwd(), "src/components/customer/CustomerEmailAuthPanel.tsx"),
  "utf8"
);
const mobileAuthPanelSource = readFileSync(
  resolve(process.cwd(), "src/components/customer/CustomerMobileAuthPanel.tsx"),
  "utf8"
);
const knownAccountsSource = readFileSync(
  resolve(process.cwd(), "src/components/customer/CustomerKnownAccounts.tsx"),
  "utf8"
);
const authServiceSource = readFileSync(
  resolve(process.cwd(), "src/services/customerAuthService.ts"),
  "utf8"
);

assert.match(registerSource, /CustomerMobileRegistrationPanel/);
assert.match(registerSource, /onMobileStart/);
assert.doesNotMatch(registerSource, /customer-register-mobile__action/);
assert.match(registrationMobilePanelSource, /requestCustomerRegistrationMobileVerification/);
assert.match(registrationMobilePanelSource, /verifyCustomerRegistrationMobileVerification/);
assert.match(registrationMobilePanelSource, /Mobile sign-up/);
assert.match(registrationMobilePanelSource, /Send code/);
assert.match(registrationMobilePanelSource, /Verify/);
assert.match(authServiceSource, /\/api\/customer-auth\/registration\/mobile\/request/);
assert.match(authServiceSource, /\/api\/customer-auth\/registration\/mobile\/verify/);

assert.match(loginSource, /CustomerKnownAccounts/);
assert.match(knownAccountsSource, /Known accounts/);
assert.match(knownAccountsSource, /Continue/);
assert.match(knownAccountsSource, /Forget/);
assert.match(knownAccountsSource, /Verification required/);
assert.match(emailAuthPanelSource, /Remember this account for 30 days/);
assert.match(mobileAuthPanelSource, /Remember this account for 30 days/);
assert.match(authServiceSource, /\/api\/customer-auth\/remembered/);
assert.match(authServiceSource, /rememberFor30Days/);
assert.doesNotMatch(authServiceSource, /localStorage/);

assert.match(loginSource, /googleHelperText="Use your Google account for faster sign-in\."/);
assert.match(loginSource, /emailLabel="Email"/);
assert.match(loginSource, /emailHelperText="Use your verified account email"/);
assert.match(loginSource, /mobileLabel="Mobile"/);
assert.match(loginSource, /mobileHelperText="Use your registered PH mobile number"/);
assert.doesNotMatch(loginSource, /Continue with Email OTP/);
assert.doesNotMatch(loginSource, /Continue with Mobile OTP/);

assert.match(registerSource, /Verify Email Address/);
assert.match(registerSource, /Verify Mobile Number/);
assert.match(
  registerSource,
  /googleHelperText="Verify your Google account for faster sign-up and sign-in\."/
);
assert.match(registerSource, /emailHelperText="Verify the required email for your new account\."/);
assert.match(registerSource, /mobileHelperText="Verify an optional PH mobile number\."/);
assert.doesNotMatch(registerSource, /Continue with Email OTP/);
assert.doesNotMatch(registerSource, /Continue with Mobile OTP/);

console.log("Customer auth UI state contract passed.");
