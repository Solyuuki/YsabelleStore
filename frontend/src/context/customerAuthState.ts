import type { Customer, CustomerAuthStatus } from "@/types/customerAuth";

export function resolveCustomerAuthStatus(
  customer: Customer | null,
  loading: boolean
): CustomerAuthStatus {
  if (loading) return "loading";
  return customer ? "authenticated" : "unauthenticated";
}
