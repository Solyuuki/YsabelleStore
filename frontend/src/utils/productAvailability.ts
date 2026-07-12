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
      buttonLabel: "Set to Unavailable",
      compactButtonLabel: "Unavailable",
      compactLoadingLabel: "Updating…",
      loadingLabel: "Setting to Unavailable...",
      nextStatus: "INACTIVE",
      successMessage:
        "The product is no longer available in POS. Its inventory and history were preserved.",
      successTitle: "Product unavailable",
      tooltip: "Make this product unavailable in POS"
    };
  }

  if (status === "INACTIVE") {
    return {
      buttonLabel: "Set to Available",
      compactButtonLabel: "Available",
      compactLoadingLabel: "Updating…",
      loadingLabel: "Setting to Available...",
      nextStatus: "ACTIVE",
      successMessage: "The product is available in POS again when valid stock is present.",
      successTitle: "Product available",
      tooltip: "Make this product available in POS"
    };
  }

  return null;
}
