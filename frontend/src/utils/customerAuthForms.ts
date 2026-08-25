import type { CustomerLoginInput, CustomerRegisterInput } from "@/types/customerAuth";

type LoginErrors = Partial<Record<keyof CustomerLoginInput, string>>;
type RegisterErrors = Partial<Record<keyof CustomerRegisterInput, string>>;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function validateCustomerLoginForm(input: CustomerLoginInput): LoginErrors {
  const errors: LoginErrors = {};

  if (!isValidEmail(input.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (!input.password) {
    errors.password = "Enter your password.";
  }

  return errors;
}

export function validateCustomerRegisterForm(input: CustomerRegisterInput): RegisterErrors {
  const errors: RegisterErrors = {};

  if (input.name.trim().length < 2) {
    errors.name = "Name must be at least 2 characters.";
  }

  if (!isValidEmail(input.email)) {
    errors.email = "Enter a valid email address.";
  }

  if (input.phone && input.phone.trim().length < 7) {
    errors.phone = "Phone number must be at least 7 characters.";
  }

  if (input.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  return errors;
}
