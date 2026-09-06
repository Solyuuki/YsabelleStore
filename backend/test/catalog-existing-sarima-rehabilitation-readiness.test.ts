import assert from "node:assert/strict";
import test from "node:test";

import {
  EXISTING_SARIMA_REHABILITATION_IDENTITIES,
  buildExistingSarimaRehabilitationReadiness
} from "../src/modules/catalog/catalog-existing-sarima-rehabilitation-readiness.js";

test("approved-import rehabilitation cohort is locked to the exact 20 SARIMA identities", () => {
  assert.equal(EXISTING_SARIMA_REHABILITATION_IDENTITIES.length, 20);
  assert.deepEqual(
    EXISTING_SARIMA_REHABILITATION_IDENTITIES.map((row) => row.sarimaSourceProductId).sort(),
    [
      "P022",
      "P038",
      "P054",
      "P065",
      "P078",
      "P080",
      "P088",
      "P091",
      "P098",
      "P102",
      "P144",
      "P217",
      "P218",
      "P237",
      "P241",
      "P261",
      "P370",
      "P385",
      "P425",
      "P443"
    ]
  );
});

test("readiness matrix reports barcode evidence, database images, image-engine outcome, and identity blockers independently", () => {
  const matrix = buildExistingSarimaRehabilitationReadiness({
    identities: [
      {
        id: "prd-p022",
        sku: "SARIMA-P022",
        sarimaSourceProductId: "P022"
      },
      {
        id: "prd-p144",
        sku: "SARIMA-P144",
        sarimaSourceProductId: "P144"
      }
    ],
    products: [
      {
        id: "prd-p022",
        sku: "SARIMA-P022",
        barcode: null,
        name: "Gardenia Enriched White Bread 600g",
        recordSource: "IMPORT",
        status: "INACTIVE",
        dataQualityStatus: "NEEDS_REVIEW",
        isStorefrontVisible: false,
        sarimaSourceProductId: "P022",
        existingImageAssetCount: 1
      },
      {
        id: "prd-p144",
        sku: "SARIMA-P144",
        barcode: null,
        name: "Ligo Sardines in Tomato Sauce, Chili Added 155g",
        recordSource: "IMPORT",
        status: "INACTIVE",
        dataQualityStatus: "NEEDS_REVIEW",
        isStorefrontVisible: false,
        sarimaSourceProductId: "P144",
        existingImageAssetCount: 1
      }
    ],
    promotionRows: [
      {
        productCode: "P022",
        identityStatus: "CANONICAL",
        canonicalProductCode: "P022",
        imageStatus: "EXACT_MATCH",
        assetFileIds: ["drive-p022"],
        identityReason: "Historical SARIMA identity remains a distinct canonical candidate.",
        imageReason: "Normalized source and Drive identities match exactly."
      },
      {
        productCode: "P144",
        identityStatus: "BLOCKED_REVIEW",
        canonicalProductCode: "P014",
        imageStatus: "NEEDS_REVIEW",
        assetFileIds: [],
        identityReason:
          "Historical source identity shares the same product family with already-resolved P014.",
        imageReason:
          "Historical source identity shares the same product family with already-resolved P014."
      }
    ]
  });

  assert.deepEqual(matrix.summary, {
    products: 2,
    barcodeMissing: 2,
    barcodePresentUnverified: 0,
    identityClear: 1,
    identityBlocked: 1,
    imageExactMatch: 1,
    imageNeedsReview: 1,
    imageVariantSizeMismatch: 0,
    imageDuplicate: 0,
    imageMissing: 0,
    databaseImageAssets: 2,
    catalogImageCandidateAssets: 1
  });

  assert.deepEqual(matrix.rows, [
    {
      productId: "prd-p022",
      sku: "SARIMA-P022",
      sarimaSourceProductId: "P022",
      name: "Gardenia Enriched White Bread 600g",
      barcode: null,
      barcodeReadiness: "NEEDS_VERIFIED_SOURCE",
      existingImageAssetCount: 1,
      catalogImageStatus: "EXACT_MATCH",
      catalogImageAssetFileIds: ["drive-p022"],
      catalogImageReason: "Normalized source and Drive identities match exactly.",
      identityStatus: "CANONICAL",
      canonicalProductCode: "P022",
      identityReadiness: "CLEAR",
      identityReason: "Historical SARIMA identity remains a distinct canonical candidate."
    },
    {
      productId: "prd-p144",
      sku: "SARIMA-P144",
      sarimaSourceProductId: "P144",
      name: "Ligo Sardines in Tomato Sauce, Chili Added 155g",
      barcode: null,
      barcodeReadiness: "NEEDS_VERIFIED_SOURCE",
      existingImageAssetCount: 1,
      catalogImageStatus: "NEEDS_REVIEW",
      catalogImageAssetFileIds: [],
      catalogImageReason:
        "Historical source identity shares the same product family with already-resolved P014.",
      identityStatus: "BLOCKED_REVIEW",
      canonicalProductCode: "P014",
      identityReadiness: "BLOCKED",
      identityReason:
        "Historical source identity shares the same product family with already-resolved P014."
    }
  ]);
});

test("readiness matrix fails closed when a product is no longer demoted or its SARIMA identity drifts", () => {
  assert.throws(
    () =>
      buildExistingSarimaRehabilitationReadiness({
        identities: [{ id: "prd-p022", sku: "SARIMA-P022", sarimaSourceProductId: "P022" }],
        products: [
          {
            id: "prd-p022",
            sku: "SARIMA-P022",
            barcode: null,
            name: "Gardenia Enriched White Bread 600g",
            recordSource: "IMPORT",
            status: "ACTIVE",
            dataQualityStatus: "NEEDS_REVIEW",
            isStorefrontVisible: false,
            sarimaSourceProductId: "P022",
            existingImageAssetCount: 1
          }
        ],
        promotionRows: [
          {
            productCode: "P022",
            identityStatus: "CANONICAL",
            canonicalProductCode: "P022",
            imageStatus: "EXACT_MATCH",
            assetFileIds: ["drive-p022"],
            identityReason: "canonical",
            imageReason: "exact"
          }
        ]
      }),
    /EXISTING_SARIMA_REHABILITATION_STATE_MISMATCH/
  );
});

test("barcode presence is reported as unverified evidence, never auto-approved", () => {
  const matrix = buildExistingSarimaRehabilitationReadiness({
    identities: [{ id: "prd-p022", sku: "SARIMA-P022", sarimaSourceProductId: "P022" }],
    products: [
      {
        id: "prd-p022",
        sku: "SARIMA-P022",
        barcode: "4800000000001",
        name: "Gardenia Enriched White Bread 600g",
        recordSource: "IMPORT",
        status: "INACTIVE",
        dataQualityStatus: "NEEDS_REVIEW",
        isStorefrontVisible: false,
        sarimaSourceProductId: "P022",
        existingImageAssetCount: 0
      }
    ],
    promotionRows: [
      {
        productCode: "P022",
        identityStatus: "CANONICAL",
        canonicalProductCode: "P022",
        imageStatus: "MISSING_IMAGE",
        assetFileIds: [],
        identityReason: "canonical",
        imageReason: "missing"
      }
    ]
  });

  assert.equal(matrix.rows[0]?.barcodeReadiness, "PRESENT_UNVERIFIED");
  assert.equal(matrix.summary.barcodePresentUnverified, 1);
  assert.equal(matrix.summary.barcodeMissing, 0);
});
