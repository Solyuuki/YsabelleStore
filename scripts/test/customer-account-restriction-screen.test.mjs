import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const backend = read("backend/src/services/customerAuthService.ts");
const restriction = read("backend/src/services/customerAccountRestriction.ts");
const client = read("frontend/src/services/apiClient.ts");
const context = read("frontend/src/context/CustomerAuthContext.tsx");
const app = read("frontend/src/app/CustomerApp.tsx");

test("customer restriction is not disclosed until a valid password is verified", () => {
  const passwordCheck = backend.indexOf("const passwordMatches = await verifyPassword");
  const statusCheck = backend.indexOf("customerAccountRestriction(customer.status)");
  assert.ok(passwordCheck >= 0 && statusCheck > passwordCheck);
  assert.match(restriction, /CUSTOMER_ACCOUNT_SUSPENDED/);
  assert.match(restriction, /CUSTOMER_ACCOUNT_BANNED/);
  assert.match(restriction, /HttpError\(403/);
});

test("moderated sessions and social login carry distinct account restriction codes", () => {
  assert.match(backend, /customerAccountRestriction\(session.customerAccount.status\)/);
  assert.match(client, /CUSTOMER_RESTRICTION_EVENT/);
  assert.match(context, /addEventListener\(CUSTOMER_RESTRICTION_EVENT/);
  assert.match(context, /visibilitychange/);
  assert.match(context, /refreshSession/);
});

test("account restriction reuses the responsive system status screen", () => {
  assert.match(app, /<StatusScreen/);
  assert.match(app, /critical/);
  assert.match(app, /statusLabel="403"/);
  assert.match(app, /Account suspended/);
  assert.match(app, /Account banned/);
  assert.match(app, /Contact customer support/);
  assert.match(app, /leaveRestrictedAccount\("\/support"\)/);
  assert.match(app, /Back to sign in/);
  assert.match(app, /void logout\(\)/);
  assert.match(app, /leaveRestrictedAccount\("\/login"\)/);
});
