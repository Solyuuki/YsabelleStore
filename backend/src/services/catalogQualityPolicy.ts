import {
  CatalogQualityStatus,
  CatalogRecordSource,
  ProductImageProcessingStatus,
  ProductImageQualityStatus
} from "@prisma/client";
import type { Prisma } from "@prisma/client";

const unresolvedDuplicateStatuses = ["PENDING", "CONFIRMED"] as const;

export const APPROVED_STOREFRONT_PRODUCT_IMAGE_PREFIX = "/images/products/";

export const approvedStorefrontProductImageWhere = {
  OR: [
    {
      imageUrl: {
        endsWith: ".webp",
        startsWith: APPROVED_STOREFRONT_PRODUCT_IMAGE_PREFIX
      }
    },
    {
      activeImageAsset: {
        is: {
          cardStorageKey: { not: null },
          pdpStorageKey: { not: null },
          processingStatus: ProductImageProcessingStatus.READY,
          qualityStatus: ProductImageQualityStatus.APPROVED
        }
      }
    }
  ]
} satisfies Prisma.ProductWhereInput;

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

/**
 * Temporary customer-catalog gate while the complete verified image library is collected.
 * Sprint 6 extends the gate to also trust the currently active CIQE asset when processing and
 * image quality are both approved. It remains presentation-only: internal product validity,
 * forecasting, inventory, and sales keep their existing domain policies.
 */
export const temporaryImageReadyStorefrontProductWhere = {
  AND: [approvedStorefrontProductCoreWhere, approvedStorefrontProductImageWhere]
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
      temporaryImageReadyStorefrontProductWhere,
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
