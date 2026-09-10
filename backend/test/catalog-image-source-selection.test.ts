import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCatalogImageSourceSelection,
  buildCatalogImageEngineJobs
} from "../src/modules/catalog/catalog-image-source-selection.js";

const rows = [
  {
    productId: "p022",
    sku: "SARIMA-P022",
    sarimaSourceProductId: "P022",
    name: "Gardenia Enriched White Bread 600g",
    status: "READY" as const,
    proposedAction: "CREATE_ENGINE_ASSET" as const,
    catalogImageStatus: "EXACT_MATCH" as const,
    catalogImageFileIds: ["drive-p022"],
    catalogImageFilenames: ["Gardenia Enriched White Bread 600g.jpg"],
    catalogImageReason: "exact",
    existingImageAssetIds: [],
    activeImageAssetId: null,
    matchedExistingImageAssetId: null,
    crossProductConflictCodes: []
  },
  {
    productId: "p091",
    sku: "SARIMA-P091",
    sarimaSourceProductId: "P091",
    name: "Star Nutri-Meats Giniling Afritada 100g",
    status: "BLOCKED_VARIANT_SIZE_MISMATCH" as const,
    proposedAction: "NONE" as const,
    catalogImageStatus: "VARIANT_SIZE_MISMATCH" as const,
    catalogImageFileIds: ["drive-wrong-a", "drive-wrong-b"],
    catalogImageFilenames: ["Classic Guisado.png", "Oyster Sauce.webp"],
    catalogImageReason: "variant conflict",
    existingImageAssetIds: [],
    activeImageAssetId: null,
    matchedExistingImageAssetId: null,
    crossProductConflictCodes: []
  },
  {
    productId: "p144",
    sku: "SARIMA-P144",
    sarimaSourceProductId: "P144",
    name: "Ligo Sardines in Tomato Sauce, Chili Added 155g",
    status: "BLOCKED_NEEDS_REVIEW" as const,
    proposedAction: "NONE" as const,
    catalogImageStatus: "NEEDS_REVIEW" as const,
    catalogImageFileIds: [],
    catalogImageFilenames: [],
    catalogImageReason: "identity review",
    existingImageAssetIds: [],
    activeImageAssetId: null,
    matchedExistingImageAssetId: null,
    crossProductConflictCodes: []
  }
];

const promotionRows = [
  {
    productCode: "P022",
    identityStatus: "CANONICAL" as const,
    canonicalProductCode: "P022",
    imageStatus: "EXACT_MATCH" as const,
    assetFileIds: ["drive-p022"],
    identityReason: "canonical",
    imageReason: "exact"
  },
  {
    productCode: "P091",
    identityStatus: "CANONICAL" as const,
    canonicalProductCode: "P091",
    imageStatus: "VARIANT_SIZE_MISMATCH" as const,
    assetFileIds: ["drive-wrong-a", "drive-wrong-b"],
    identityReason: "canonical",
    imageReason: "variant conflict"
  },
  {
    productCode: "P144",
    identityStatus: "BLOCKED_REVIEW" as const,
    canonicalProductCode: "P014",
    imageStatus: "NEEDS_REVIEW" as const,
    assetFileIds: [],
    identityReason: "duplicate-family identity review",
    imageReason: "identity review"
  }
];

test("Drive exact-match source wins when its local source bytes are materialized", () => {
  const selection = buildCatalogImageSourceSelection({
    rows,
    promotionRows,
    driveMaterializations: [
      {
        productCode: "P022",
        fileId: "drive-p022",
        sourcePath: "staging/P022/source.jpg",
        usable: true
      }
    ],
    webEvidence: []
  });

  assert.equal(selection.rows[0]?.status, "READY_DRIVE");
  assert.equal(selection.rows[0]?.selectedSourceKind, "DRIVE");
  assert.equal(selection.rows[0]?.selectedSourcePath, "staging/P022/source.jpg");
});

test("existing Drive exact match must be materialized before web fallback is considered", () => {
  const selection = buildCatalogImageSourceSelection({
    rows,
    promotionRows,
    driveMaterializations: [],
    webEvidence: [
      {
        productCode: "P022",
        sourceAssetId: "web-p022",
        sourceType: "MANUFACTURER" as const,
        provider: "Gardenia",
        sourceUrl: "https://example.com/gardenia",
        licenseBasis: "Manufacturer media asset approved for commercial catalog reuse.",
        licenseUrl: "https://example.com/terms",
        commercialUseAllowed: true,
        exactProductIdentity: true,
        exactRetailUnit: true,
        watermarkFree: true,
        sourcePath: "staging/web/P022/source.jpg",
        retrievedAt: "2026-09-02T00:00:00Z"
      }
    ]
  });

  assert.equal(selection.rows[0]?.status, "NEEDS_DRIVE_MATERIALIZATION");
  assert.equal(selection.rows[0]?.selectedSourceKind, null);
});

test("licensed exact web evidence can replace mismatched Drive candidates for an identity-clear product", () => {
  const selection = buildCatalogImageSourceSelection({
    rows,
    promotionRows,
    driveMaterializations: [],
    webEvidence: [
      {
        productCode: "P091",
        sourceAssetId: "web-p091",
        sourceType: "AUTHORIZED_SUPPLIER" as const,
        provider: "Authorized supplier",
        sourceUrl: "https://supplier.example/star-afritada-100g",
        licenseBasis: "Supplier explicitly permits commercial product-catalog reuse.",
        licenseUrl: "https://supplier.example/media-terms",
        commercialUseAllowed: true,
        exactProductIdentity: true,
        exactRetailUnit: true,
        watermarkFree: true,
        sourcePath: "staging/web/P091/source.png",
        retrievedAt: "2026-09-02T00:00:00Z"
      }
    ]
  });

  assert.equal(selection.rows[1]?.status, "READY_LICENSED_WEB");
  assert.equal(selection.rows[1]?.selectedSourceKind, "LICENSED_WEB");
  assert.equal(selection.rows[1]?.selectedSourceReference, "web-p091");
});

test("retailer/public image without explicit commercial-use evidence never becomes a web source", () => {
  const selection = buildCatalogImageSourceSelection({
    rows,
    promotionRows,
    driveMaterializations: [],
    webEvidence: [
      {
        productCode: "P091",
        sourceAssetId: "retailer-p091",
        sourceType: "RETAILER" as const,
        provider: "Retailer",
        sourceUrl: "https://retailer.example/item",
        licenseBasis: "Public product page only.",
        licenseUrl: null,
        commercialUseAllowed: false,
        exactProductIdentity: true,
        exactRetailUnit: true,
        watermarkFree: true,
        sourcePath: "staging/web/P091/source.png",
        retrievedAt: "2026-09-02T00:00:00Z"
      }
    ]
  });

  assert.equal(selection.rows[1]?.status, "NEEDS_LICENSED_WEB_FALLBACK");
  assert.equal(selection.rows[1]?.selectedSourceKind, null);
});

test("identity-blocked products never accept Drive or web fallback sources", () => {
  const selection = buildCatalogImageSourceSelection({
    rows,
    promotionRows,
    driveMaterializations: [],
    webEvidence: [
      {
        productCode: "P144",
        sourceAssetId: "web-p144",
        sourceType: "MANUFACTURER" as const,
        provider: "Manufacturer",
        sourceUrl: "https://manufacturer.example/p144",
        licenseBasis: "Commercial media asset.",
        licenseUrl: "https://manufacturer.example/terms",
        commercialUseAllowed: true,
        exactProductIdentity: true,
        exactRetailUnit: true,
        watermarkFree: true,
        sourcePath: "staging/web/P144/source.jpg",
        retrievedAt: "2026-09-02T00:00:00Z"
      }
    ]
  });

  assert.equal(selection.rows[2]?.status, "BLOCKED_IDENTITY_REVIEW");
  assert.equal(selection.rows[2]?.selectedSourceKind, null);
});

test("CIQE jobs include only selected sources and preserve provenance reference", () => {
  const selection = buildCatalogImageSourceSelection({
    rows,
    promotionRows,
    driveMaterializations: [
      {
        productCode: "P022",
        fileId: "drive-p022",
        sourcePath: "staging/P022/source.jpg",
        usable: true
      }
    ],
    webEvidence: [
      {
        productCode: "P091",
        sourceAssetId: "web-p091",
        sourceType: "LICENSED_LIBRARY" as const,
        provider: "Licensed library",
        sourceUrl: "https://library.example/p091",
        licenseBasis: "Commercial-use license.",
        licenseUrl: "https://library.example/license",
        commercialUseAllowed: true,
        exactProductIdentity: true,
        exactRetailUnit: true,
        watermarkFree: true,
        sourcePath: "staging/web/P091/source.png",
        retrievedAt: "2026-09-02T00:00:00Z"
      }
    ]
  });

  assert.deepEqual(buildCatalogImageEngineJobs(selection), [
    {
      productCode: "P022",
      fileId: "drive-p022",
      sourcePath: "staging/P022/source.jpg",
      reconciliationStatus: "EXACT_MATCH"
    },
    {
      productCode: "P091",
      fileId: "WEB:web-p091",
      sourcePath: "staging/web/P091/source.png",
      reconciliationStatus: "EXACT_MATCH"
    }
  ]);
});
