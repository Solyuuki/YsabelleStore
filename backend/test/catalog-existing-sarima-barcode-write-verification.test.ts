import assert from "node:assert/strict";
import test from "node:test";

import { buildExistingSarimaBarcodeWriteVerification } from "../src/modules/catalog/catalog-existing-sarima-barcode-write-verification.js";

const authorization = {
  identities: [
    {
      id: "p1",
      sku: "SARIMA-P022",
      name: "Gardenia Enriched White Bread 600g",
      sarimaSourceProductId: "P022",
      barcode: "4806502720615"
    },
    {
      id: "p2",
      sku: "SARIMA-P088",
      name: "Fresca Tuna Flakes in Oil 175g",
      sarimaSourceProductId: "P088",
      barcode: "748485900094"
    }
  ]
} as const;

test("verification confirms exact barcode values while review/inactive/hidden state and SARIMA mappings remain preserved", () => {
  const result = buildExistingSarimaBarcodeWriteVerification({
    authorization,
    products: [
      {
        id: "p1", sku: "SARIMA-P022", name: "Gardenia Enriched White Bread 600g",
        barcode: "4806502720615", recordSource: "IMPORT", status: "INACTIVE",
        dataQualityStatus: "NEEDS_REVIEW", isStorefrontVisible: false,
        sarimaSourceProductId: "P022"
      },
      {
        id: "p2", sku: "SARIMA-P088", name: "Fresca Tuna Flakes in Oil 175g",
        barcode: "748485900094", recordSource: "IMPORT", status: "INACTIVE",
        dataQualityStatus: "NEEDS_REVIEW", isStorefrontVisible: false,
        sarimaSourceProductId: "P088"
      }
    ]
  });

  assert.deepEqual(result.summary, {
    expectedProducts: 2,
    verifiedBarcodes: 2,
    preservedReviewState: 2,
    preservedSarimaMappings: 2,
    discrepancies: 0
  });
  assert.equal(result.rows.every((row) => row.status === "VERIFIED"), true);
});

test("verification surfaces any barcode or state discrepancy instead of treating it as success", () => {
  const result = buildExistingSarimaBarcodeWriteVerification({
    authorization,
    products: [
      {
        id: "p1", sku: "SARIMA-P022", name: "Gardenia Enriched White Bread 600g",
        barcode: "WRONG", recordSource: "IMPORT", status: "INACTIVE",
        dataQualityStatus: "NEEDS_REVIEW", isStorefrontVisible: false,
        sarimaSourceProductId: "P022"
      },
      {
        id: "p2", sku: "SARIMA-P088", name: "Fresca Tuna Flakes in Oil 175g",
        barcode: "748485900094", recordSource: "IMPORT", status: "ACTIVE",
        dataQualityStatus: "NEEDS_REVIEW", isStorefrontVisible: false,
        sarimaSourceProductId: "P088"
      }
    ]
  });

  assert.equal(result.summary.discrepancies, 2);
  assert.equal(result.rows[0]?.status, "DISCREPANCY");
  assert.equal(result.rows[1]?.status, "DISCREPANCY");
});

test("verification fails closed if an authorized Product is missing", () => {
  assert.throws(
    () => buildExistingSarimaBarcodeWriteVerification({
      authorization,
      products: [
        {
          id: "p1", sku: "SARIMA-P022", name: "Gardenia Enriched White Bread 600g",
          barcode: "4806502720615", recordSource: "IMPORT", status: "INACTIVE",
          dataQualityStatus: "NEEDS_REVIEW", isStorefrontVisible: false,
          sarimaSourceProductId: "P022"
        }
      ]
    }),
    /EXISTING_SARIMA_BARCODE_WRITE_VERIFICATION_IDENTITY_MISMATCH/
  );
});
