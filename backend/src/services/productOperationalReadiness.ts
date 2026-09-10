import type { Category, Inventory, Product } from "@prisma/client";

export type ProductOperationalReadinessCode =
  | "TEST_FIXTURE"
  | "CATALOG_REVIEW_REQUIRED"
  | "CATALOG_REJECTED"
  | "MISSING_VERIFIED_BARCODE"
  | "MISSING_PROCUREMENT_COST"
  | "INVALID_SELLING_PRICE"
  | "UNRESOLVED_DUPLICATE"
  | "CATEGORY_INACTIVE"
  | "CATEGORY_REVIEW_REQUIRED"
  | "CATEGORY_REJECTED"
  | "INVENTORY_NOT_LINKED";

export type ProductOperationalReadinessBlocker = {
  code: ProductOperationalReadinessCode;
  label: string;
};

export type ProductOperationalReadiness = {
  ready: boolean;
  blockers: ProductOperationalReadinessBlocker[];
};

type ProductOperationalReadinessInput = Pick<
  Product,
  "barcode" | "costPrice" | "dataQualityStatus" | "recordSource" | "sellingPrice"
> & {
  category: Pick<Category, "dataQualityStatus" | "isActive" | "recordSource">;
  inventory: Pick<Inventory, "id"> | null;
  duplicateCandidatesLeft?: Array<{ status: string }>;
  duplicateCandidatesRight?: Array<{ status: string }>;
};

const unresolvedDuplicateStatuses = new Set(["PENDING", "CONFIRMED"]);

export function getProductOperationalReadiness(
  product: ProductOperationalReadinessInput
): ProductOperationalReadiness {
  const blockers: ProductOperationalReadinessBlocker[] = [];
  const add = (code: ProductOperationalReadinessCode, label: string) => {
    blockers.push({ code, label });
  };

  if (product.recordSource === "TEST_FIXTURE") {
    add("TEST_FIXTURE", "Test fixture cannot be operational");
  }

  if (product.dataQualityStatus === "NEEDS_REVIEW") {
    add("CATALOG_REVIEW_REQUIRED", "Catalog review required");
  } else if (product.dataQualityStatus === "REJECTED") {
    add("CATALOG_REJECTED", "Catalog record rejected");
  }

  if (!product.barcode?.trim()) {
    add("MISSING_VERIFIED_BARCODE", "Missing verified barcode");
  }

  if (!product.costPrice || product.costPrice.lessThanOrEqualTo(0)) {
    add("MISSING_PROCUREMENT_COST", "Missing procurement cost");
  }

  if (product.sellingPrice.lessThanOrEqualTo(0)) {
    add("INVALID_SELLING_PRICE", "Selling price must be greater than zero");
  }

  const hasUnresolvedDuplicate = [
    ...(product.duplicateCandidatesLeft ?? []),
    ...(product.duplicateCandidatesRight ?? [])
  ].some((candidate) => unresolvedDuplicateStatuses.has(candidate.status));

  if (hasUnresolvedDuplicate) {
    add("UNRESOLVED_DUPLICATE", "Resolve duplicate review");
  }

  if (!product.category.isActive) {
    add("CATEGORY_INACTIVE", "Category is inactive");
  }

  if (product.category.recordSource === "TEST_FIXTURE") {
    add("CATEGORY_REJECTED", "Category is not operational");
  } else if (product.category.dataQualityStatus === "NEEDS_REVIEW") {
    add("CATEGORY_REVIEW_REQUIRED", "Category approval required");
  } else if (product.category.dataQualityStatus === "REJECTED") {
    add("CATEGORY_REJECTED", "Category rejected");
  }

  if (!product.inventory?.id) {
    add("INVENTORY_NOT_LINKED", "Inventory record missing");
  }

  return {
    ready: blockers.length === 0,
    blockers
  };
}
