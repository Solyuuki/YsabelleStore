import type { PosSale } from "@/types/pos";

/** WEB sales identify the customer, not a potentially unassigned cashier. */
export function getSaleAttribution(sale: PosSale) {
  const isWebOrder = sale.source === "WEB" || sale.saleNumber.startsWith("WEB-");

  return isWebOrder
    ? { label: "Customer", name: sale.customerName?.trim() || "Name unavailable" }
    : { label: "Cashier", name: sale.cashierName?.trim() || "Unknown" };
}
