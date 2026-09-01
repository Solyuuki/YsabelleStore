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
const emailAuthPanelSource = readFileSync(
  resolve(process.cwd(), "src/components/customer/CustomerEmailAuthPanel.tsx"),
  "utf8"
);
const knownAccountsSource = readFileSync(
  resolve(process.cwd(), "src/components/customer/CustomerKnownAccounts.tsx"),
  "utf8"
);
const socialButtonsSource = readFileSync(
  resolve(process.cwd(), "src/components/customer/CustomerSocialAuthButtons.tsx"),
  "utf8"
);
const authServiceSource = readFileSync(
  resolve(process.cwd(), "src/services/customerAuthService.ts"),
  "utf8"
);

assert.doesNotMatch(registerSource, /CustomerMobileRegistrationPanel/);
assert.doesNotMatch(registerSource, /onMobileStart/);
assert.doesNotMatch(registerSource, /Verify Mobile Number/);
assert.doesNotMatch(authServiceSource, /\/api\/customer-auth\/registration\/mobile\/request/);
assert.doesNotMatch(authServiceSource, /\/api\/customer-auth\/registration\/mobile\/verify/);

assert.match(loginSource, /CustomerKnownAccounts/);
assert.match(knownAccountsSource, /Email Quick Sign/);
assert.match(knownAccountsSource, /Saved email accounts/);
assert.match(knownAccountsSource, /\{accounts\.length\}\/\{maxAccounts\}/);
assert.match(knownAccountsSource, /customer-known-account__select/);
assert.match(knownAccountsSource, /MoreVertical/);
assert.match(knownAccountsSource, /Forget account/);
assert.match(knownAccountsSource, /Verification required/);
assert.doesNotMatch(knownAccountsSource, /className="customer-known-account__continue"/);
assert.doesNotMatch(knownAccountsSource, /Continue on this browser without another code/);
assert.match(emailAuthPanelSource, /Remember this account for 30 days/);
assert.match(authServiceSource, /\/api\/customer-auth\/remembered/);
assert.match(authServiceSource, /rememberFor30Days/);
assert.doesNotMatch(authServiceSource, /localStorage/);

assert.match(loginSource, /googleHelperText="Use your Google account for faster sign-in\."/);
assert.match(loginSource, /emailLabel="Email"/);
assert.match(loginSource, /emailHelperText="Use your verified account email"/);
assert.doesNotMatch(loginSource, /mobileLabel=/);
assert.doesNotMatch(loginSource, /mobileHelperText=/);
assert.doesNotMatch(loginSource, /requestCustomerMobileAuth/);
assert.doesNotMatch(loginSource, /verifyCustomerMobileAuth/);
assert.doesNotMatch(socialButtonsSource, /Mobile Quick Sign/);
assert.doesNotMatch(socialButtonsSource, /onMobileClick/);
assert.doesNotMatch(authServiceSource, /\/api\/customer-auth\/mobile\/request/);
assert.doesNotMatch(authServiceSource, /\/api\/customer-auth\/mobile\/verify/);
assert.doesNotMatch(loginSource, /Continue with Email OTP/);
assert.doesNotMatch(loginSource, /Continue with Mobile OTP/);

assert.match(registerSource, /CustomerEmailAuthPanel/);
assert.match(registerSource, /CustomerEmailRegistrationPanel/);
assert.match(registerSource, /emailLabel="Continue with Email OTP"/);
assert.match(
  registerSource,
  /googleHelperText="Verify your Google account for faster sign-up and sign-in\."/
);
assert.match(
  registerSource,
  /emailHelperText="Use only your email to sign in or create an account\."/
);
assert.match(registerSource, /setVerificationPanel\("quick-email"\)/);
assert.match(registerSource, /verificationPanel === "quick-email"/);
assert.match(registerSource, /onVerified=\{handleQuickSignVerified\}/);
assert.match(
  registerSource,
  /async function handleQuickSignVerified\(\)[\s\S]*?await refreshSession\(\);[\s\S]*?navigate\("\/"\);/
);
assert.doesNotMatch(registerSource, /This verified email can be used for Email Quick Sign\./);
assert.doesNotMatch(registerSource, /mobileLabel=/);
assert.doesNotMatch(registerSource, /mobileHelperText=/);
assert.doesNotMatch(registerSource, /Continue with Mobile OTP/);

console.log("Customer auth UI state contract passed.");
