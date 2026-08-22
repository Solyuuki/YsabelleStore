import assert from "node:assert/strict";

import {
  validateCustomerLoginForm,
  validateCustomerRegisterForm
} from "../frontend/src/utils/customerAuthForms.ts";

assert.deepEqual(
  validateCustomerLoginForm({ email: "", password: "" }),
  {
    email: "Enter a valid email address.",
    password: "Enter your password."
  }
);

assert.deepEqual(
  validateCustomerLoginForm({ email: "customer@example.com", password: "CustomerPass123!" }),
  {}
);

assert.deepEqual(
  validateCustomerRegisterForm({
    email: "bad-email",
    name: "M",
    password: "short",
    phone: "123"
  }),
  {
    email: "Enter a valid email address.",
    name: "Name must be at least 2 characters.",
    password: "Password must be at least 8 characters.",
    phone: "Phone number must be at least 7 characters."
  }
);

assert.deepEqual(
  validateCustomerRegisterForm({
    email: "customer@example.com",
    name: "Maria Customer",
    password: "CustomerPass123!",
    phone: "09171234567"
  }),
  {}
);

assert.deepEqual(
  validateCustomerRegisterForm({
    email: "customer@example.com",
    name: "Maria Customer",
    password: "CustomerPass123!",
    phone: ""
  }),
  {}
);

console.log("Customer auth form validation contract passed.");
