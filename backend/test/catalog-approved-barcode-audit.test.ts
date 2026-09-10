import assert from "node:assert/strict";
import test from "node:test";

import { buildApprovedProductBarcodeAudit } from "../src/modules/catalog/catalog-approved-barcode-audit.js";

test("approved barcode audit separates missing barcodes without guessing provenance", () => {
  const audit = buildApprovedProductBarcodeAudit([
    {
      id: "historical-approved",
      sku: "SARIMA-P001",
      barcode: null,
      name: "Historical Product",
      categoryName: "Beverages",
      recordSource: "CATALOG",
      status: "ACTIVE",
      isStorefrontVisible: true,
      sarimaSourceProductId: "P001",
      hasInventoryRecord: true,
      relationshipCounts: {
        inventoryBatches: 1,
        inventoryMovements: 2,
        saleItems: 0,
        forecastRecords: 1,
        recommendationRecords: 0,
        historicalMonthlySales: 24,
        historicalSalesImportRows: 24,
        customerOrderItems: 0,
        productReviews: 0,
        imageAssets: 0
      }
    },
    {
      id: "approved-with-barcode",
      sku: "CAT-001",
      barcode: "4800000000001",
      name: "Verified Product",
      categoryName: "Snacks",
      recordSource: "CATALOG",
      status: "ACTIVE",
      isStorefrontVisible: true,
      sarimaSourceProductId: null,
      hasInventoryRecord: true,
      relationshipCounts: {
        inventoryBatches: 1,
        inventoryMovements: 1,
        saleItems: 1,
        forecastRecords: 0,
        recommendationRecords: 0,
        historicalMonthlySales: 0,
        historicalSalesImportRows: 0,
        customerOrderItems: 0,
        productReviews: 0,
        imageAssets: 1
      }
    },
    {
      id: "internal-approved",
      sku: "INTERNAL-001",
      barcode: null,
      name: "Internal Approved Product",
      categoryName: "Other",
      recordSource: "INTERNAL",
      status: "INACTIVE",
      isStorefrontVisible: false,
      sarimaSourceProductId: null,
      hasInventoryRecord: false,
      relationshipCounts: {
        inventoryBatches: 0,
        inventoryMovements: 0,
        saleItems: 0,
        forecastRecords: 0,
        recommendationRecords: 0,
        historicalMonthlySales: 0,
        historicalSalesImportRows: 0,
        customerOrderItems: 0,
        productReviews: 0,
        imageAssets: 0
      }
    }
  ]);

  assert.deepEqual(audit.summary, {
    approvedProducts: 3,
    approvedWithBarcode: 1,
    approvedMissingBarcode: 2,
    activeApprovedMissingBarcode: 1,
    storefrontApprovedMissingBarcode: 1,
    sarimaMappedApproved: 1,
    sarimaMappedApprovedMissingBarcode: 1
  });

  assert.deepEqual(
    audit.rows.map(
      (row: {
        barcodeStatus: "MISSING" | "PRESENT";
        productId: string;
        protectedReferenceCount: number;
        sarimaSourceProductId: string | null;
      }) => ({
        id: row.productId,
        barcodeStatus: row.barcodeStatus,
        sarimaSourceProductId: row.sarimaSourceProductId,
        protectedReferenceCount: row.protectedReferenceCount
      })
    ),
    [
      {
        id: "historical-approved",
        barcodeStatus: "MISSING",
        sarimaSourceProductId: "P001",
        protectedReferenceCount: 53
      },
      {
        id: "internal-approved",
        barcodeStatus: "MISSING",
        sarimaSourceProductId: null,
        protectedReferenceCount: 0
      },
      {
        id: "approved-with-barcode",
        barcodeStatus: "PRESENT",
        sarimaSourceProductId: null,
        protectedReferenceCount: 5
      }
    ]
  );
});
