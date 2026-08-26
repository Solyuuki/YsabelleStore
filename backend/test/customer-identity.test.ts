import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyCustomerLoginIdentifier,
  isReservedCustomerUsername,
  normalizeCustomerEmail,
  normalizeCustomerUsername,
  normalizePhilippineMobile
} from "../src/utils/customerIdentity.js";

test("normalizes supported Philippine mobile representations to one canonical identity", () => {
  const inputs = [
    "09171234567",
    "639171234567",
    "+639171234567",
    "0917 123 4567",
    "0917-123-4567",
    "(+63) 917 123 4567"
  ];

  for (const input of inputs) {
    assert.equal(normalizePhilippineMobile(input), "+639171234567");
  }
});

test("rejects non-Philippine and malformed mobile identities", () => {
  assert.equal(normalizePhilippineMobile("+14155552671"), null);
  assert.equal(normalizePhilippineMobile("0917123456"), null);
  assert.equal(normalizePhilippineMobile("0917/123/4567"), null);
  assert.equal(normalizePhilippineMobile("not-a-phone"), null);
});

test("normalizes valid usernames case-insensitively", () => {
  assert.equal(normalizeCustomerUsername("Maria.Santos"), "maria.santos");
  assert.equal(normalizeCustomerUsername("  QA_Customer  "), "qa_customer");
  assert.equal(normalizeCustomerUsername("juan2026"), "juan2026");
});

test("rejects usernames that can masquerade as another identifier or violate policy", () => {
  assert.equal(normalizeCustomerUsername("09171234567"), null);
  assert.equal(normalizeCustomerUsername("maria@gmail.com"), null);
  assert.equal(normalizeCustomerUsername("+639171234567"), null);
  assert.equal(normalizeCustomerUsername("ab"), null);
  assert.equal(normalizeCustomerUsername("name-with-dash"), null);
  assert.equal(normalizeCustomerUsername(".leadingdot"), null);
});

test("rejects reserved customer usernames case-insensitively", () => {
  for (const value of ["admin", "OWNER", "staff", "Support", "ysabelle", "YsabelleStore"]) {
    assert.equal(isReservedCustomerUsername(value), true);
    assert.equal(normalizeCustomerUsername(value), null);
  }

  assert.equal(isReservedCustomerUsername("customer"), false);
});

test("normalizes email identities to trimmed lowercase values", () => {
  assert.equal(normalizeCustomerEmail(" Maria@Example.COM "), "maria@example.com");
  assert.equal(normalizeCustomerEmail("not-an-email"), null);
});

test("classifies email-looking identifiers as email without username fallback", () => {
  assert.deepEqual(classifyCustomerLoginIdentifier("Maria@Example.COM"), {
    kind: "email",
    normalized: "maria@example.com"
  });
  assert.equal(classifyCustomerLoginIdentifier("invalid@email"), null);
});

test("classifies Philippine mobile identifiers before username resolution", () => {
  for (const value of ["09171234567", "639171234567", "+639171234567"]) {
    assert.deepEqual(classifyCustomerLoginIdentifier(value), {
      kind: "phone",
      normalized: "+639171234567"
    });
  }
});

test("does not reinterpret phone-shaped invalid input as a username", () => {
  assert.equal(classifyCustomerLoginIdentifier("+14155552671"), null);
  assert.equal(classifyCustomerLoginIdentifier("0917123456"), null);
});

test("classifies remaining valid values as normalized usernames", () => {
  assert.deepEqual(classifyCustomerLoginIdentifier("Maria.Santos"), {
    kind: "username",
    normalized: "maria.santos"
  });
  assert.equal(classifyCustomerLoginIdentifier("admin"), null);
});
