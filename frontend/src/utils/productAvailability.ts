import type { ProductRecord } from "@/services/catalogApi";

type AvailabilityStatus = Extract<ProductRecord["status"], "ACTIVE" | "INACTIVE">;

export type ProductAvailabilityAction = {
  buttonLabel: string;
  compactButtonLabel: string;
  compactLoadingLabel: string;
  loadingLabel: string;
  nextStatus: AvailabilityStatus;
  successMessage: string;
  successTitle: string;
  tooltip: string;
};

export function getProductStatusLabel(status: ProductRecord["status"]) {
  return status === "ACTIVE" ? "AVAILABLE" : "UNAVAILABLE";
}

export function getProductStatusVariant(status: ProductRecord["status"]) {
  return status === "ACTIVE" ? "success" : "warning";
}

export function getAvailabilityAction(
  status: ProductRecord["status"]
): ProductAvailabilityAction | null {
  if (status === "ACTIVE") {
    return {
      buttonLabel: "Available",
      compactButtonLabel: "Available",
      compactLoadingLabel: "Updating…",
      loadingLabel: "Updating availability...",
      nextStatus: "INACTIVE",
      successMessage: "The product is unavailable in POS.",
      successTitle: "Product unavailable",
      tooltip: "Currently available. Click to make this product unavailable in POS."
    };
  }

  if (status === "INACTIVE") {
    return {
      buttonLabel: "Unavailable",
      compactButtonLabel: "Unavailable",
      compactLoadingLabel: "Updating…",
      loadingLabel: "Updating availability...",
      nextStatus: "ACTIVE",
      successMessage: "The product is available in POS.",
      successTitle: "Product available",
      tooltip: "Currently unavailable. Click to make this product available in POS."
    };
  }

  return null;
}
