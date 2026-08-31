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

const registerSource = readFileSync(
  resolve(process.cwd(), "src/pages/customer/CustomerRegisterPage.tsx"),
  "utf8"
);
const registrationMobilePanelSource = readFileSync(
  resolve(process.cwd(), "src/components/customer/CustomerMobileRegistrationPanel.tsx"),
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

console.log("Customer auth UI state contract passed.");
