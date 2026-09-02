import assert from "node:assert/strict";
import test from "node:test";

import {
  assertApprovedProductBarcode,
  approvedStorefrontProductCoreWhere
} from "../src/services/catalogQualityPolicy.js";

test("catalog approval requires a barcode even when storefront visibility is false", () => {
  assert.throws(
    () =>
      assertApprovedProductBarcode({
        barcode: null,
        dataQualityStatus: "APPROVED",
        isStorefrontVisible: false
      }),
    (error) =>
      error instanceof Error &&
      (error as Error & { code?: string }).code === "PRODUCT_BARCODE_APPROVAL_REQUIRED"
  );
});

test("storefront visibility requires a barcode", () => {
  assert.throws(
    () =>
      assertApprovedProductBarcode({
        barcode: null,
        dataQualityStatus: "NEEDS_REVIEW",
        isStorefrontVisible: true
      }),
    (error) =>
      error instanceof Error &&
      (error as Error & { code?: string }).code === "PRODUCT_BARCODE_APPROVAL_REQUIRED"
  );
});

test("needs-review hidden products may remain without a barcode while verification is pending", () => {
  assert.doesNotThrow(() =>
    assertApprovedProductBarcode({
      barcode: null,
      dataQualityStatus: "NEEDS_REVIEW",
      isStorefrontVisible: false
    })
  );
});

test("approved products with a barcode pass the barcode gate", () => {
  assert.doesNotThrow(() =>
    assertApprovedProductBarcode({
      barcode: "4800000000001",
      dataQualityStatus: "APPROVED",
      isStorefrontVisible: true
    })
  );
});

test("storefront query gate excludes products with null barcodes as defense in depth", () => {
  assert.deepEqual(approvedStorefrontProductCoreWhere.barcode, { not: null });
});
