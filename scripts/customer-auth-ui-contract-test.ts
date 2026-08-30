import assert from "node:assert/strict";

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

console.log("Customer auth UI state contract passed.");