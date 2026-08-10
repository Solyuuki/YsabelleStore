import { CatalogQualityStatus, CatalogRecordSource } from "@prisma/client";
import type { Prisma } from "@prisma/client";

const unresolvedDuplicateStatuses = ["PENDING", "CONFIRMED"] as const;

export const approvedStorefrontCategoryWhere = {
  dataQualityStatus: CatalogQualityStatus.APPROVED,
  isActive: true,
  isStorefrontVisible: true,
  recordSource: { not: CatalogRecordSource.TEST_FIXTURE }
} satisfies Prisma.CategoryWhereInput;

export const approvedStorefrontProductCoreWhere = {
  dataQualityStatus: CatalogQualityStatus.APPROVED,
  duplicateCandidatesLeft: {
    none: { status: { in: [...unresolvedDuplicateStatuses] } }
  },
  duplicateCandidatesRight: {
    none: { status: { in: [...unresolvedDuplicateStatuses] } }
  },
  isStorefrontVisible: true,
  recordSource: { not: CatalogRecordSource.TEST_FIXTURE },
  sellingPrice: { gt: 0 },
  sourceMapping: { is: null },
  status: "ACTIVE"
} satisfies Prisma.ProductWhereInput;

export const operationalCatalogProductWhere = {
  dataQualityStatus: { not: CatalogQualityStatus.REJECTED },
  recordSource: { not: CatalogRecordSource.TEST_FIXTURE },
  sourceMapping: { is: null }
} satisfies Prisma.ProductWhereInput;

export function storefrontProductWhere(
  additionalWhere: Prisma.ProductWhereInput = {}
): Prisma.ProductWhereInput {
  return {
    AND: [
      approvedStorefrontProductCoreWhere,
      { category: { is: approvedStorefrontCategoryWhere } },
      additionalWhere
    ]
  };
}

export function operationalProductWhere(
  additionalWhere: Prisma.ProductWhereInput = {}
): Prisma.ProductWhereInput {
  return { AND: [operationalCatalogProductWhere, additionalWhere] };
}
