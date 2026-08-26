import type { CustomerLoginInput, CustomerRegisterInput } from "@/types/customerAuth";

type LoginErrors = Partial<Record<keyof CustomerLoginInput, string>>;
export type CustomerRegisterFormInput = CustomerRegisterInput & {
  confirmPassword: string;
};
type RegisterErrors = Partial<Record<keyof CustomerRegisterFormInput, string>>;

const RESERVED_CUSTOMER_USERNAMES = new Set([
  "admin",
  "owner",
  "staff",
  "support",
  "ysabelle",
  "ysabellestore"
]);

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidCustomerUsername(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._]{2,29}$/.test(normalized)) return false;
  if (/^\d+$/.test(normalized)) return false;
  return !RESERVED_CUSTOMER_USERNAMES.has(normalized);
}

function isValidPhilippineMobile(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (!/^[+()\d\s-]+$/.test(trimmed)) return false;

  const compact = trimmed.replace(/[\s()-]/g, "");
  return /^09\d{9}$/.test(compact) || /^639\d{9}$/.test(compact) || /^\+639\d{9}$/.test(compact);
}

export function validateCustomerLoginForm(input: CustomerLoginInput): LoginErrors {
  const errors: LoginErrors = {};

  if (!input.identifier.trim()) {
    errors.identifier = "Enter your username, email, or mobile number.";
  }

  if (!input.password) {
    errors.password = "Enter your password.";
  }

  return errors;
}

export function validateCustomerRegisterForm(input: CustomerRegisterFormInput): RegisterErrors {
  const errors: RegisterErrors = {};

  if (input.name.trim().length < 2) {
    errors.name = "Name must be at least 2 characters.";
  }

  if (!isValidCustomerUsername(input.username)) {
    errors.username =
      "Use 3-30 letters, numbers, dots, or underscores. Start with a letter or number.";
  }

  if (!isValidEmail(input.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (input.phone && !isValidPhilippineMobile(input.phone)) {
    errors.phone = "Enter a valid Philippine mobile number.";
  }

  if (input.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  if (input.confirmPassword !== input.password) {
    errors.confirmPassword = "Passwords do not match.";
  }

  return errors;
}
