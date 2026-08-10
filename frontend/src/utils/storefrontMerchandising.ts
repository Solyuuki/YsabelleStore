import type { StorefrontProduct } from "@/types/storefront";

export type StorefrontProductBadge = {
  label: string;
  tone: "best-seller" | "low-stock" | "trending";
};

export function getStorefrontProductBadge(
  product: StorefrontProduct,
  placement: "best-seller" | "standard" | "trending" = "standard",
  rank?: number
): StorefrontProductBadge | null {
  if (placement === "trending") return { label: "Trending", tone: "trending" };
  if (placement === "best-seller") {
    return {
      label: rank === 1 ? "No. 1 best seller" : "Best seller",
      tone: "best-seller"
    };
  }
  if (product.stockStatus === "LOW_STOCK") return { label: "Low stock", tone: "low-stock" };
  return null;
}
