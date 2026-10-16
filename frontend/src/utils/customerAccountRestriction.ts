export type CustomerRestriction = "SUSPENDED" | "BANNED";

export const CUSTOMER_RESTRICTION_EVENT = "ysabelle:customer-account-restricted";

export function customerRestrictionFromCode(code: unknown): CustomerRestriction | null {
  if (code === "CUSTOMER_ACCOUNT_SUSPENDED") return "SUSPENDED";
  if (code === "CUSTOMER_ACCOUNT_BANNED") return "BANNED";
  return null;
}

export function customerRestrictionFromSocialCallback(search: string): CustomerRestriction | null {
  const status = new URLSearchParams(search).get("social");
  if (status === "account_suspended") return "SUSPENDED";
  if (status === "account_banned") return "BANNED";
  return null;
}
