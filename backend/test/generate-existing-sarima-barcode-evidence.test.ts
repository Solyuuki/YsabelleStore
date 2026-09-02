import assert from "node:assert/strict";
import test from "node:test";

import {
  EXISTING_SARIMA_EXTERNAL_BARCODE_EVIDENCE,
  buildBarcodeEvidenceForProducts
} from "../src/scripts/generateExistingSarimaBarcodeEvidence.js";

test("external evidence manifest covers exactly 19 identity-clear products and excludes P144", () => {
  assert.equal(EXISTING_SARIMA_EXTERNAL_BARCODE_EVIDENCE.length, 19);
  const codes = EXISTING_SARIMA_EXTERNAL_BARCODE_EVIDENCE.map((row) => row.sarimaSourceProductId).sort();
  assert.equal(codes.includes("P144"), false);
  assert.deepEqual(codes, [
    "P022", "P038", "P054", "P065", "P078", "P080", "P088", "P091", "P098", "P102",
    "P217", "P218", "P237", "P241", "P261", "P370", "P385", "P425", "P443"
  ]);
});

test("manifest records defensible exact-unit evidence without upgrading weak candidates", () => {
  const byCode = new Map(
    EXISTING_SARIMA_EXTERNAL_BARCODE_EVIDENCE.map((row) => [row.sarimaSourceProductId, row])
  );

  assert.equal(byCode.get("P022")?.candidateBarcode, "4806502720615");
  assert.equal(byCode.get("P022")?.sources.length, 2);
  assert.equal(byCode.get("P088")?.candidateBarcode, "748485900094");
  assert.equal(byCode.get("P217")?.candidateBarcode, "4801981107971");
  assert.equal(byCode.get("P218")?.candidateBarcode, "4800049720107");
  assert.equal(byCode.get("P241")?.candidateBarcode, "4800024556929");
  assert.equal(byCode.get("P370")?.candidateBarcode, "4800016644504");

  assert.equal(byCode.get("P038")?.candidateBarcode, "4808887970531");
  assert.equal(byCode.get("P038")?.sources.length, 1);
  assert.equal(byCode.get("P261")?.candidateBarcode, "4801981116072");
  assert.equal(byCode.get("P261")?.sources.length, 1);
});

test("generated matrix verifies only evidence that meets the independent-source policy", () => {
  const products = EXISTING_SARIMA_EXTERNAL_BARCODE_EVIDENCE.map((evidence) => ({
    id: evidence.productId,
    sku: evidence.sku,
    sarimaSourceProductId: evidence.sarimaSourceProductId,
    name: `Product ${evidence.sarimaSourceProductId}`,
    barcode: null,
    recordSource: "IMPORT",
    status: "INACTIVE",
    dataQualityStatus: "NEEDS_REVIEW",
    isStorefrontVisible: false
  }));

  const matrix = buildBarcodeEvidenceForProducts(products);
  const byCode = new Map(matrix.rows.map((row) => [row.sarimaSourceProductId, row]));

  for (const code of ["P022", "P088", "P217", "P218", "P241", "P370"]) {
    assert.equal(byCode.get(code)?.status, "VERIFIED_EXTERNAL", code);
    assert.notEqual(byCode.get(code)?.verifiedBarcode, null, code);
  }

  for (const code of ["P038", "P065", "P261"]) {
    assert.equal(byCode.get(code)?.status, "NEEDS_PHYSICAL_SCAN", code);
    assert.equal(byCode.get(code)?.verifiedBarcode, null, code);
  }

  assert.equal(matrix.summary.products, 19);
  assert.equal(matrix.summary.verifiedExternal, 6);
  assert.equal(matrix.summary.needsPhysicalScan + matrix.summary.conflictingEvidence + matrix.summary.notFound, 13);
});
