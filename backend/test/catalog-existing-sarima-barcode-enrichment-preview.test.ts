import assert from "node:assert/strict";
import test from "node:test";

import { buildExistingSarimaBarcodeEnrichmentPreview } from "../src/modules/catalog/catalog-existing-sarima-barcode-enrichment-preview.js";

const products = [
  {
    id: "p1",
    sku: "SARIMA-P022",
    sarimaSourceProductId: "P022",
    name: "Gardenia Enriched White Bread 600g",
    barcode: null,
    recordSource: "IMPORT",
    status: "INACTIVE",
    dataQualityStatus: "NEEDS_REVIEW",
    isStorefrontVisible: false
  },
  {
    id: "p2",
    sku: "SARIMA-P088",
    sarimaSourceProductId: "P088",
    name: "Fresca Tuna Flakes in Oil 175g",
    barcode: null,
    recordSource: "IMPORT",
    status: "INACTIVE",
    dataQualityStatus: "NEEDS_REVIEW",
    isStorefrontVisible: false
  }
];

const evidence = {
  summary: {
    products: 2,
    verifiedExternal: 2,
    needsPhysicalScan: 0,
    conflictingEvidence: 0,
    notFound: 0
  },
  rows: [
    {
      productId: "p1",
      sku: "SARIMA-P022",
      sarimaSourceProductId: "P022",
      name: "Gardenia Enriched White Bread 600g",
      status: "VERIFIED_EXTERNAL" as const,
      candidateBarcode: "4806502720615",
      verifiedBarcode: "4806502720615",
      sourceCount: 2,
      exactUnitSourceCount: 2,
      authoritativeExactUnitSourceCount: 0,
      independentRetailerExactUnitSourceCount: 2,
      conflictReason: null,
      sources: []
    },
    {
      productId: "p2",
      sku: "SARIMA-P088",
      sarimaSourceProductId: "P088",
      name: "Fresca Tuna Flakes in Oil 175g",
      status: "VERIFIED_EXTERNAL" as const,
      candidateBarcode: "748485900094",
      verifiedBarcode: "748485900094",
      sourceCount: 2,
      exactUnitSourceCount: 2,
      authoritativeExactUnitSourceCount: 0,
      independentRetailerExactUnitSourceCount: 2,
      conflictReason: null,
      sources: []
    }
  ]
};

test("preview proposes barcode-only writes for verified rows with no database collision", () => {
  const preview = buildExistingSarimaBarcodeEnrichmentPreview({
    products,
    evidence,
    barcodeOwners: []
  });

  assert.deepEqual(preview.summary, {
    verifiedCandidates: 2,
    readyToWrite: 2,
    blockedBarcodeCollisions: 0,
    plannedBarcodeWrites: 2
  });
  assert.deepEqual(
    preview.rows.map((row) => ({
      id: row.productId,
      barcode: row.proposedBarcode,
      status: row.status,
      collisionIds: row.collisionProductIds
    })),
    [
      { id: "p1", barcode: "4806502720615", status: "READY", collisionIds: [] },
      { id: "p2", barcode: "748485900094", status: "READY", collisionIds: [] }
    ]
  );
});

test("preview blocks a verified barcode already owned by another Product", () => {
  const preview = buildExistingSarimaBarcodeEnrichmentPreview({
    products,
    evidence,
    barcodeOwners: [
      { id: "other", sku: "OTHER-001", name: "Other Product", barcode: "4806502720615" }
    ]
  });

  assert.equal(preview.summary.readyToWrite, 1);
  assert.equal(preview.summary.blockedBarcodeCollisions, 1);
  assert.equal(preview.summary.plannedBarcodeWrites, 1);
  assert.equal(preview.rows[0]?.status, "BLOCKED_BARCODE_COLLISION");
  assert.deepEqual(preview.rows[0]?.collisionProductIds, ["other"]);
});

test("preview fails closed if a target Product no longer has the demoted rehabilitation state", () => {
  assert.throws(
    () =>
      buildExistingSarimaBarcodeEnrichmentPreview({
        products: [{ ...products[0]!, status: "ACTIVE" }, products[1]!],
        evidence,
        barcodeOwners: []
      }),
    /EXISTING_SARIMA_BARCODE_ENRICHMENT_STATE_MISMATCH/
  );
});

test("preview fails closed when verified evidence identity no longer matches the Product", () => {
  assert.throws(
    () =>
      buildExistingSarimaBarcodeEnrichmentPreview({
        products,
        evidence: {
          ...evidence,
          rows: [{ ...evidence.rows[0]!, sku: "WRONG" }, evidence.rows[1]!]
        },
        barcodeOwners: []
      }),
    /EXISTING_SARIMA_BARCODE_ENRICHMENT_IDENTITY_MISMATCH/
  );
});

test("duplicate proposed barcode across verified targets is blocked for every affected row", () => {
  const duplicateEvidence = {
    ...evidence,
    rows: [
      evidence.rows[0]!,
      { ...evidence.rows[1]!, candidateBarcode: "4806502720615", verifiedBarcode: "4806502720615" }
    ]
  };

  const preview = buildExistingSarimaBarcodeEnrichmentPreview({
    products,
    evidence: duplicateEvidence,
    barcodeOwners: []
  });

  assert.equal(preview.summary.readyToWrite, 0);
  assert.equal(preview.summary.blockedBarcodeCollisions, 2);
  assert.equal(preview.summary.plannedBarcodeWrites, 0);
  assert.equal(preview.rows.every((row) => row.status === "BLOCKED_BARCODE_COLLISION"), true);
});
