import assert from "node:assert/strict";

import {
  validateCustomerLoginForm,
  validateCustomerRegisterForm
} from "../frontend/src/utils/customerAuthForms.ts";

assert.deepEqual(validateCustomerLoginForm({ identifier: "", password: "" }), {
  identifier: "Enter your username, email, or mobile number.",
  password: "Enter your password."
});

assert.deepEqual(
  validateCustomerLoginForm({
    identifier: "customer@example.com",
    password: "CustomerPass123!"
  }),
  {}
);

assert.deepEqual(
  validateCustomerRegisterForm({
    confirmPassword: "short",
    email: "bad-email",
    name: "M",
    password: "short",
    phone: "123",
    username: "valid.user"
  }),
  {
    email: "Enter a valid email address.",
    name: "Name must be at least 2 characters.",
    password: "Password must be at least 8 characters.",
    phone: "Enter a valid Philippine mobile number."
  }
);

assert.deepEqual(
  validateCustomerRegisterForm({
    confirmPassword: "CustomerPass123!",
    email: "customer@example.com",
    name: "Maria Customer",
    password: "CustomerPass123!",
    phone: "09171234567",
    username: "maria.customer"
  }),
  {}
);

assert.deepEqual(
  validateCustomerRegisterForm({
    confirmPassword: "CustomerPass123!",
    email: "customer@example.com",
    name: "Maria Customer",
    password: "CustomerPass123!",
    phone: "",
    username: "maria.customer"
  }),
  {}
);

console.log("Customer auth form validation contract passed.");