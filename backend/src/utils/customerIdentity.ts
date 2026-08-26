const RESERVED_CUSTOMER_USERNAMES = new Set([
  "admin",
  "owner",
  "staff",
  "support",
  "ysabelle",
  "ysabellestore"
]);

const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._]{2,29}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PRESENTATION_PATTERN = /^[+()\d\s-]+$/;

export type CustomerLoginIdentifier =
  | { kind: "email"; normalized: string }
  | { kind: "phone"; normalized: string }
  | { kind: "username"; normalized: string };

export function isReservedCustomerUsername(value: string): boolean {
  return RESERVED_CUSTOMER_USERNAMES.has(value.trim().toLowerCase());
}

export function normalizeCustomerUsername(value: string): string | null {
  const normalized = value.trim().toLowerCase();

  if (!USERNAME_PATTERN.test(normalized)) return null;
  if (/^\d+$/.test(normalized)) return null;
  if (isReservedCustomerUsername(normalized)) return null;

  return normalized;
}

export function normalizeCustomerEmail(value: string): string | null {
  const normalized = value.trim().toLowerCase();

  if (!normalized || normalized.length > 191) return null;
  if (!EMAIL_PATTERN.test(normalized)) return null;

  return normalized;
}

export function normalizePhilippineMobile(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || !PHONE_PRESENTATION_PATTERN.test(trimmed)) return null;

  const compact = trimmed.replace(/[\s()-]/g, "");

  let nationalDigits: string;
  if (/^09\d{9}$/.test(compact)) {
    nationalDigits = compact.slice(1);
  } else if (/^639\d{9}$/.test(compact)) {
    nationalDigits = compact.slice(2);
  } else if (/^\+639\d{9}$/.test(compact)) {
    nationalDigits = compact.slice(3);
  } else {
    return null;
  }

  return `+63${nationalDigits}`;
}

function looksPhoneShaped(value: string): boolean {
  return PHONE_PRESENTATION_PATTERN.test(value.trim());
}

export function classifyCustomerLoginIdentifier(value: string): CustomerLoginIdentifier | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.includes("@")) {
    const normalized = normalizeCustomerEmail(trimmed);
    return normalized ? { kind: "email", normalized } : null;
  }

  const normalizedPhone = normalizePhilippineMobile(trimmed);
  if (normalizedPhone) {
    return { kind: "phone", normalized: normalizedPhone };
  }

  if (looksPhoneShaped(trimmed)) return null;

  const normalizedUsername = normalizeCustomerUsername(trimmed);
  return normalizedUsername ? { kind: "username", normalized: normalizedUsername } : null;
}
