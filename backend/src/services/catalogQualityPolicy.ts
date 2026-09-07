import {
  CatalogQualityStatus,
  CatalogRecordSource,
  ProductImageProcessingStatus,
  ProductImageQualityStatus
} from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { UNRESOLVED_CATALOG_IMAGE_CLEANUP_IDENTITIES } from "../modules/catalog/catalog-unresolved-image-cleanup-authorization.js";
import { HttpError } from "../utils/httpError.js";

const unresolvedDuplicateStatuses = ["PENDING", "CONFIRMED"] as const;
const unresolvedCatalogImageSourceIds = UNRESOLVED_CATALOG_IMAGE_CLEANUP_IDENTITIES.map(
  (row) => row.productCode
);

const unresolvedCatalogImageExclusionWhere = {
  NOT: {
    sarimaSourceMapping: {
      is: { sourceProductId: { in: unresolvedCatalogImageSourceIds } }
    }
  }
} satisfies Prisma.ProductWhereInput;

export const APPROVED_STOREFRONT_PRODUCT_IMAGE_PREFIX = "/images/products/";

export function assertApprovedProductBarcode(input: {
  barcode: string | null | undefined;
  dataQualityStatus: "APPROVED" | "NEEDS_REVIEW" | "REJECTED";
  isStorefrontVisible: boolean;
}) {
  const requiresVerifiedBarcode =
    input.dataQualityStatus === CatalogQualityStatus.APPROVED || input.isStorefrontVisible;

  if (requiresVerifiedBarcode && !input.barcode?.trim()) {
    throw new HttpError(
      422,
      "Approved or storefront-visible products require a verified barcode.",
      { code: "PRODUCT_BARCODE_APPROVAL_REQUIRED" }
    );
  }
}

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
  barcode: { not: null },
  dataQualityStatus: CatalogQualityStatus.APPROVED,
  duplicateCandidatesLeft: {
    none: { status: { in: [...unresolvedDuplicateStatuses] } }
  },
  duplicateCandidatesRight: {
    none: { status: { in: [...unresolvedDuplicateStatuses] } }
  },
  isStorefrontVisible: true,
  ...unresolvedCatalogImageExclusionWhere,
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
 *
 * Products whose frozen Phase 9 source image outcome is unresolved are excluded here even when a
 * stale local imageUrl still matches the legacy path convention. This keeps broken placeholders
 * out of the customer catalog without deleting products or operational history.
 */
export const temporaryImageReadyStorefrontProductWhere = {
  AND: [approvedStorefrontProductCoreWhere, approvedStorefrontProductImageWhere]
} satisfies Prisma.ProductWhereInput;

export function isPresentationCatalogEnabled(environment: NodeJS.ProcessEnv = process.env) {
  return environment.YSABELLE_PRESENTATION_CATALOG === "1";
}

export const presentationStorefrontCategoryWhere = {
  dataQualityStatus: {
    not: CatalogQualityStatus.REJECTED
  },
  isActive: true,
  recordSource: {
    not: CatalogRecordSource.TEST_FIXTURE
  }
} satisfies Prisma.CategoryWhereInput;

export const presentationStorefrontProductWhere = {
  dataQualityStatus: {
    not: CatalogQualityStatus.REJECTED
  },
  recordSource: {
    not: CatalogRecordSource.TEST_FIXTURE
  },
  sellingPrice: {
    gt: 0
  },
  sarimaSourceMapping: {
    isNot: null
  },
  ...unresolvedCatalogImageExclusionWhere
} satisfies Prisma.ProductWhereInput;

export function storefrontCategoryWhere(
  presentationMode = isPresentationCatalogEnabled()
): Prisma.CategoryWhereInput {
  return presentationMode ? presentationStorefrontCategoryWhere : approvedStorefrontCategoryWhere;
}

export function storefrontCategoryProductWhere(
  presentationMode = isPresentationCatalogEnabled()
): Prisma.ProductWhereInput {
  return presentationMode
    ? {
        OR: [temporaryImageReadyStorefrontProductWhere, presentationStorefrontProductWhere]
      }
    : temporaryImageReadyStorefrontProductWhere;
}

export const operationalCatalogProductWhere = {
  dataQualityStatus: { not: CatalogQualityStatus.REJECTED },
  recordSource: { not: CatalogRecordSource.TEST_FIXTURE },
  sourceMapping: { is: null }
} satisfies Prisma.ProductWhereInput;

export function storefrontProductWhere(
  additionalWhere: Prisma.ProductWhereInput = {},
  presentationMode = isPresentationCatalogEnabled()
): Prisma.ProductWhereInput {
  return {
    AND: [
      storefrontCategoryProductWhere(presentationMode),
      {
        category: {
          is: storefrontCategoryWhere(presentationMode)
        }
      },
      additionalWhere
    ]
  };
}

export function operationalProductWhere(
  additionalWhere: Prisma.ProductWhereInput = {}
): Prisma.ProductWhereInput {
  return { AND: [operationalCatalogProductWhere, additionalWhere] };
}
