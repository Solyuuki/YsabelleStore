import {
  PROTECTED_REVIEWED_PRODUCT_CODE,
  UNRESOLVED_CATALOG_IMAGE_CLEANUP_EXPECTED_COUNT,
  UNRESOLVED_CATALOG_IMAGE_CLEANUP_IDENTITIES,
  type UnresolvedCatalogImageCleanupIdentity
} from "./catalog-unresolved-image-cleanup-authorization.js";

type CountResult = { count: number };

type SarimaMappingRow = {
  sourceProductId: string;
  sourceProductName: string;
  canonicalProductId: string;
};

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  recordSource: string;
  dataQualityStatus: string;
  isStorefrontVisible: boolean;
  status: string;
};

export type UnresolvedCatalogImageQuarantineTransaction = {
  sarimaSourceProductMapping: {
    findMany(args: unknown): Promise<SarimaMappingRow[]>;
  };
  product: {
    findMany(args: unknown): Promise<ProductRow[]>;
    updateMany(args: unknown): Promise<CountResult>;
  };
};

export type UnresolvedCatalogImageQuarantineClient = {
  $transaction<T>(
    callback: (tx: UnresolvedCatalogImageQuarantineTransaction) => Promise<T>
  ): Promise<T>;
};

export type UnresolvedCatalogImageQuarantineResult = {
  summary: {
    authorizedSourceIdentities: number;
    mappedCanonicalProducts: number;
    unmatchedSourceIdentities: number;
    newlyHiddenProducts: number;
    alreadyQuarantinedProducts: number;
    updatedProducts: number;
    preservedOperationalProducts: number;
  };
  unmatchedSourceProductIds: string[];
  quarantined: Array<{
    sourceProductId: string;
    canonicalProductId: string;
    sku: string;
    sourceProductName: string;
  }>;
};

function fail(code: string, detail?: string): never {
  throw new Error(detail ? `${code}: ${detail}` : code);
}

function validateAuthorization(
  identities: readonly UnresolvedCatalogImageCleanupIdentity[]
): Map<string, UnresolvedCatalogImageCleanupIdentity> {
  if (identities.length !== UNRESOLVED_CATALOG_IMAGE_CLEANUP_EXPECTED_COUNT) {
    fail(
      "CATALOG_UNRESOLVED_IMAGE_AUTHORIZATION_MISMATCH",
      `expected ${UNRESOLVED_CATALOG_IMAGE_CLEANUP_EXPECTED_COUNT} frozen source identities, received ${identities.length}`
    );
  }

  const byProductCode = new Map<string, UnresolvedCatalogImageCleanupIdentity>();
  for (const identity of identities) {
    const productCode = identity.productCode.trim().toUpperCase();
    if (!/^P\d{3}$/.test(productCode) || productCode !== identity.productCode) {
      fail(
        "CATALOG_UNRESOLVED_IMAGE_AUTHORIZATION_MISMATCH",
        `invalid frozen product code ${identity.productCode}`
      );
    }
    if (productCode === PROTECTED_REVIEWED_PRODUCT_CODE) {
      fail(
        "CATALOG_UNRESOLVED_IMAGE_PROTECTED_PRODUCT",
        `${PROTECTED_REVIEWED_PRODUCT_CODE} must never be quarantined`
      );
    }
    if (byProductCode.has(productCode)) {
      fail(
        "CATALOG_UNRESOLVED_IMAGE_AUTHORIZATION_MISMATCH",
        `duplicate frozen product code ${productCode}`
      );
    }
    byProductCode.set(productCode, identity);
  }

  return byProductCode;
}

export async function executeUnresolvedCatalogImageQuarantine(input: {
  client: UnresolvedCatalogImageQuarantineClient;
  identities?: readonly UnresolvedCatalogImageCleanupIdentity[];
}): Promise<UnresolvedCatalogImageQuarantineResult> {
  const identities = input.identities ?? UNRESOLVED_CATALOG_IMAGE_CLEANUP_IDENTITIES;
  const authorizationByCode = validateAuthorization(identities);
  const sourceProductIds = [...authorizationByCode.keys()].sort();

  return input.client.$transaction(async (tx) => {
    const mappings = await tx.sarimaSourceProductMapping.findMany({
      where: { sourceProductId: { in: sourceProductIds } },
      select: {
        sourceProductId: true,
        sourceProductName: true,
        canonicalProductId: true
      },
      orderBy: { sourceProductId: "asc" }
    });

    const seenSourceIds = new Set<string>();
    const canonicalIds = new Set<string>();
    for (const mapping of mappings) {
      const authorization = authorizationByCode.get(mapping.sourceProductId);
      if (!authorization) {
        fail(
          "CATALOG_UNRESOLVED_IMAGE_IDENTITY_MISMATCH",
          `unexpected SARIMA source mapping ${mapping.sourceProductId}`
        );
      }
      if (seenSourceIds.has(mapping.sourceProductId)) {
        fail(
          "CATALOG_UNRESOLVED_IMAGE_IDENTITY_MISMATCH",
          `duplicate SARIMA mapping for ${mapping.sourceProductId}`
        );
      }
      if (mapping.sourceProductName !== authorization.sourceName) {
        fail(
          "CATALOG_UNRESOLVED_IMAGE_SOURCE_DRIFT",
          `${mapping.sourceProductId} source name changed from reviewed reconciliation evidence`
        );
      }
      if (mapping.sourceProductId === PROTECTED_REVIEWED_PRODUCT_CODE) {
        fail(
          "CATALOG_UNRESOLVED_IMAGE_PROTECTED_PRODUCT",
          `${PROTECTED_REVIEWED_PRODUCT_CODE} must never be quarantined`
        );
      }
      if (canonicalIds.has(mapping.canonicalProductId)) {
        fail(
          "CATALOG_UNRESOLVED_IMAGE_IDENTITY_MISMATCH",
          `multiple unresolved source identities resolve to canonical product ${mapping.canonicalProductId}`
        );
      }
      seenSourceIds.add(mapping.sourceProductId);
      canonicalIds.add(mapping.canonicalProductId);
    }

    const productIds = [...canonicalIds].sort();
    const products = productIds.length
      ? await tx.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            sku: true,
            name: true,
            recordSource: true,
            dataQualityStatus: true,
            isStorefrontVisible: true,
            status: true
          },
          orderBy: { id: "asc" }
        })
      : [];

    if (products.length !== productIds.length) {
      fail(
        "CATALOG_UNRESOLVED_IMAGE_IDENTITY_MISMATCH",
        `expected ${productIds.length} mapped canonical products, found ${products.length}`
      );
    }

    const productById = new Map(products.map((product) => [product.id, product]));
    const quarantined = mappings.map((mapping) => {
      const product = productById.get(mapping.canonicalProductId);
      if (!product) {
        fail(
          "CATALOG_UNRESOLVED_IMAGE_IDENTITY_MISMATCH",
          `canonical product ${mapping.canonicalProductId} is missing`
        );
      }
      if (product.recordSource === "TEST_FIXTURE" || product.recordSource === "INTERNAL") {
        fail(
          "CATALOG_UNRESOLVED_IMAGE_RECORD_SOURCE_MISMATCH",
          `${mapping.sourceProductId} resolved to protected record source ${product.recordSource}`
        );
      }
      return {
        sourceProductId: mapping.sourceProductId,
        canonicalProductId: mapping.canonicalProductId,
        sku: product.sku,
        sourceProductName: mapping.sourceProductName
      };
    });

    const alreadyQuarantined = products.filter(
      (product) =>
        product.isStorefrontVisible === false && product.dataQualityStatus === "NEEDS_REVIEW"
    );
    const toUpdate = products.filter(
      (product) =>
        product.isStorefrontVisible !== false || product.dataQualityStatus !== "NEEDS_REVIEW"
    );

    let updatedProducts = 0;
    if (toUpdate.length > 0) {
      const updated = await tx.product.updateMany({
        where: { id: { in: toUpdate.map((product) => product.id) } },
        data: {
          dataQualityStatus: "NEEDS_REVIEW",
          isStorefrontVisible: false
        }
      });
      if (updated.count !== toUpdate.length) {
        fail(
          "CATALOG_UNRESOLVED_IMAGE_UPDATE_MISMATCH",
          `expected to quarantine ${toUpdate.length} products, updated ${updated.count}`
        );
      }
      updatedProducts = updated.count;
    }

    const unmatchedSourceProductIds = sourceProductIds.filter(
      (sourceProductId) => !seenSourceIds.has(sourceProductId)
    );

    return {
      summary: {
        authorizedSourceIdentities: identities.length,
        mappedCanonicalProducts: products.length,
        unmatchedSourceIdentities: unmatchedSourceProductIds.length,
        newlyHiddenProducts: toUpdate.filter((product) => product.isStorefrontVisible).length,
        alreadyQuarantinedProducts: alreadyQuarantined.length,
        updatedProducts,
        preservedOperationalProducts: products.length
      },
      unmatchedSourceProductIds,
      quarantined
    };
  });
}