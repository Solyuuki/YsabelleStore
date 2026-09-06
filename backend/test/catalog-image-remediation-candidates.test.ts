import assert from "node:assert/strict";
import test from "node:test";

import { buildCatalogImageRemediationCandidates } from "../src/modules/catalog/catalog-image-remediation-candidates.js";

const selection = {
  rows: [
    {
      productCode: "P022",
      productId: "p022",
      name: "Gardenia Enriched White Bread 600g",
      status: "READY_DRIVE" as const,
      selectedSourceKind: "DRIVE" as const,
      selectedSourceReference: "drive-p022",
      selectedSourcePath: ".data/P022/source.jpg",
      sourceUrl: null,
      licenseBasis: null,
      licenseUrl: null
    },
    {
      productCode: "P054",
      productId: "p054",
      name: "Sunsilk Anti Dandruff 135ml",
      status: "READY_DRIVE" as const,
      selectedSourceKind: "DRIVE" as const,
      selectedSourceReference: "drive-p054",
      selectedSourcePath: ".data/P054/source.jpg",
      sourceUrl: null,
      licenseBasis: null,
      licenseUrl: null
    },
    {
      productCode: "P065",
      productId: "p065",
      name: "Dr. S. Wong's Sulfur Soap 80g",
      status: "NEEDS_DRIVE_MATERIALIZATION" as const,
      selectedSourceKind: null,
      selectedSourceReference: null,
      selectedSourcePath: null,
      sourceUrl: null,
      licenseBasis: null,
      licenseUrl: null
    },
    {
      productCode: "P091",
      productId: "p091",
      name: "Star Nutri-Meats Giniling Afritada 100g",
      status: "NEEDS_LICENSED_WEB_FALLBACK" as const,
      selectedSourceKind: null,
      selectedSourceReference: null,
      selectedSourcePath: null,
      sourceUrl: null,
      licenseBasis: null,
      licenseUrl: null
    },
    {
      productCode: "P144",
      productId: "p144",
      name: "Ligo Sardines Chili Added 155g",
      status: "BLOCKED_IDENTITY_REVIEW" as const,
      selectedSourceKind: null,
      selectedSourceReference: null,
      selectedSourcePath: null,
      sourceUrl: null,
      licenseBasis: null,
      licenseUrl: null
    }
  ],
  summary: {
    products: 5,
    readyDrive: 2,
    readyLicensedWeb: 0,
    needsDriveMaterialization: 1,
    needsLicensedWebFallback: 1,
    blockedIdentityReview: 1
  }
};

const materializations = [
  {
    productCode: "P022",
    fileId: "drive-p022",
    sourcePath: ".data/P022/source.jpg",
    usable: true,
    sha256: "a",
    sizeBytes: 100,
    contentType: "image/jpeg",
    attempts: 1,
    error: null
  },
  {
    productCode: "P054",
    fileId: "drive-p054",
    sourcePath: ".data/P054/source.jpg",
    usable: true,
    sha256: "b",
    sizeBytes: 100,
    contentType: "image/jpeg",
    attempts: 1,
    error: null
  },
  {
    productCode: "P065",
    fileId: "drive-p065",
    sourcePath: ".data/P065/source.jpg",
    usable: false,
    sha256: null,
    sizeBytes: null,
    contentType: null,
    attempts: 2,
    error: "HTTP 403 Forbidden"
  }
];

const ciqe = {
  counts: { APPROVED: 1, REJECTED: 1, PROCESS_ERROR: 0 },
  results: [
    { productCode: "P022", fileId: "drive-p022", status: "APPROVED" },
    {
      productCode: "P054",
      fileId: "drive-p054",
      status: "REJECTED",
      diagnostics: [
        {
          code: "PDP_RESOLUTION_LOW",
          message: "Source resolution is below the preferred product-detail threshold.",
          severity: "warning"
        }
      ]
    }
  ]
};

test("builds web-fallback remediation only from exhausted Drive failures, CIQE rejects, and reconciliation fallback", () => {
  const result = buildCatalogImageRemediationCandidates({
    selection,
    materializations,
    ciqe,
    maxDriveAttempts: 2
  });

  assert.deepEqual(result.summary, {
    products: 5,
    ciqeApproved: 1,
    webFallbackCandidates: 3,
    driveMaterializationFailed: 1,
    ciqeRejected: 1,
    reconciliationRequiresWeb: 1,
    blockedIdentityReview: 1,
    processErrors: 0
  });

  assert.deepEqual(
    result.rows.map((row) => ({
      productCode: row.productCode,
      reason: row.reason,
      driveAttempts: row.driveAttempts,
      driveError: row.driveError,
      diagnosticCodes: row.diagnosticCodes
    })),
    [
      {
        productCode: "P054",
        reason: "CIQE_REJECTED",
        driveAttempts: 1,
        driveError: null,
        diagnosticCodes: ["PDP_RESOLUTION_LOW"]
      },
      {
        productCode: "P065",
        reason: "DRIVE_MATERIALIZATION_FAILED",
        driveAttempts: 2,
        driveError: "HTTP 403 Forbidden",
        diagnosticCodes: []
      },
      {
        productCode: "P091",
        reason: "RECONCILIATION_REQUIRES_WEB",
        driveAttempts: null,
        driveError: null,
        diagnosticCodes: []
      }
    ]
  );
});

test("a Drive failure that has not exhausted retries stays out of licensed-web remediation", () => {
  const result = buildCatalogImageRemediationCandidates({
    selection: {
      rows: [selection.rows[2]!],
      summary: {
        products: 1,
        readyDrive: 0,
        readyLicensedWeb: 0,
        needsDriveMaterialization: 1,
        needsLicensedWebFallback: 0,
        blockedIdentityReview: 0
      }
    },
    materializations: [{ ...materializations[2]!, attempts: 1 }],
    ciqe: { counts: { APPROVED: 0, REJECTED: 0, PROCESS_ERROR: 0 }, results: [] },
    maxDriveAttempts: 2
  });

  assert.equal(result.summary.webFallbackCandidates, 0);
  assert.equal(result.rows.length, 0);
});

test("CIQE process errors fail closed and never become automatic web replacement candidates", () => {
  const result = buildCatalogImageRemediationCandidates({
    selection: {
      rows: [selection.rows[0]!],
      summary: {
        products: 1,
        readyDrive: 1,
        readyLicensedWeb: 0,
        needsDriveMaterialization: 0,
        needsLicensedWebFallback: 0,
        blockedIdentityReview: 0
      }
    },
    materializations: [materializations[0]!],
    ciqe: {
      counts: { APPROVED: 0, REJECTED: 0, PROCESS_ERROR: 1 },
      results: [
        {
          productCode: "P022",
          fileId: "drive-p022",
          status: "PROCESS_ERROR",
          error: "decode crash"
        }
      ]
    },
    maxDriveAttempts: 2
  });

  assert.equal(result.summary.processErrors, 1);
  assert.equal(result.summary.webFallbackCandidates, 0);
  assert.equal(result.rows.length, 0);
});
