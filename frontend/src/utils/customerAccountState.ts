import type { Customer } from "@/types/customerAuth";

export function getCustomerCheckoutDefaults(customer: Customer | null) {
  return {
    customerName: customer?.name ?? "",
    customerEmail: customer?.email ?? "",
    customerPhone: customer?.phone ?? ""
  };
}
