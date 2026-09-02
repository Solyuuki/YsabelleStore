export type ApprovedProductBarcodeRelationshipCounts = {
  inventoryBatches: number;
  inventoryMovements: number;
  saleItems: number;
  forecastRecords: number;
  recommendationRecords: number;
  historicalMonthlySales: number;
  historicalSalesImportRows: number;
  customerOrderItems: number;
  productReviews: number;
  imageAssets: number;
};

export type ApprovedProductBarcodeAuditInputRow = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  categoryName: string;
  recordSource: string;
  status: string;
  isStorefrontVisible: boolean;
  sarimaSourceProductId: string | null;
  hasInventoryRecord: boolean;
  relationshipCounts: ApprovedProductBarcodeRelationshipCounts;
};

export type ApprovedProductBarcodeAuditRow = {
  productId: string;
  sku: string;
  barcode: string | null;
  barcodeStatus: "PRESENT" | "MISSING";
  name: string;
  categoryName: string;
  recordSource: string;
  status: string;
  isStorefrontVisible: boolean;
  sarimaSourceProductId: string | null;
  hasInventoryRecord: boolean;
  relationshipCounts: ApprovedProductBarcodeRelationshipCounts;
  protectedReferenceCount: number;
};

export type ApprovedProductBarcodeAudit = {
  summary: {
    approvedProducts: number;
    approvedWithBarcode: number;
    approvedMissingBarcode: number;
    activeApprovedMissingBarcode: number;
    storefrontApprovedMissingBarcode: number;
    sarimaMappedApproved: number;
    sarimaMappedApprovedMissingBarcode: number;
  };
  rows: ApprovedProductBarcodeAuditRow[];
};

function hasBarcode(barcode: string | null) {
  return Boolean(barcode?.trim());
}

function protectedReferenceCount(row: ApprovedProductBarcodeAuditInputRow) {
  return (
    (row.hasInventoryRecord ? 1 : 0) +
    Object.values(row.relationshipCounts).reduce((total, count) => total + count, 0)
  );
}

export function buildApprovedProductBarcodeAudit(
  products: ApprovedProductBarcodeAuditInputRow[]
): ApprovedProductBarcodeAudit {
  const rows = products
    .map((product): ApprovedProductBarcodeAuditRow => ({
      productId: product.id,
      sku: product.sku,
      barcode: product.barcode,
      barcodeStatus: hasBarcode(product.barcode) ? "PRESENT" : "MISSING",
      name: product.name,
      categoryName: product.categoryName,
      recordSource: product.recordSource,
      status: product.status,
      isStorefrontVisible: product.isStorefrontVisible,
      sarimaSourceProductId: product.sarimaSourceProductId,
      hasInventoryRecord: product.hasInventoryRecord,
      relationshipCounts: product.relationshipCounts,
      protectedReferenceCount: protectedReferenceCount(product)
    }))
    .sort((left, right) => {
      if (left.barcodeStatus !== right.barcodeStatus) {
        return left.barcodeStatus === "MISSING" ? -1 : 1;
      }
      if (left.isStorefrontVisible !== right.isStorefrontVisible) {
        return left.isStorefrontVisible ? -1 : 1;
      }
      return left.sku.localeCompare(right.sku) || left.productId.localeCompare(right.productId);
    });

  const missing = rows.filter((row) => row.barcodeStatus === "MISSING");

  return {
    summary: {
      approvedProducts: rows.length,
      approvedWithBarcode: rows.filter((row) => row.barcodeStatus === "PRESENT").length,
      approvedMissingBarcode: missing.length,
      activeApprovedMissingBarcode: missing.filter((row) => row.status === "ACTIVE").length,
      storefrontApprovedMissingBarcode: missing.filter((row) => row.isStorefrontVisible).length,
      sarimaMappedApproved: rows.filter((row) => Boolean(row.sarimaSourceProductId)).length,
      sarimaMappedApprovedMissingBarcode: missing.filter((row) => Boolean(row.sarimaSourceProductId))
        .length
    },
    rows
  };
}
