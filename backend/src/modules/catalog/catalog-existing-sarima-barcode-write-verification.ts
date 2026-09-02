import type { ExistingSarimaBarcodeEnrichmentAuthorization } from "./catalog-existing-sarima-barcode-enrichment-execution.js";

export type ExistingSarimaBarcodeWriteVerificationProduct = {
  id: string;
  sku: string;
  name: string;
  barcode: string | null;
  recordSource: string;
  status: string;
  dataQualityStatus: string;
  isStorefrontVisible: boolean;
  sarimaSourceProductId: string | null;
};

export type ExistingSarimaBarcodeWriteVerificationRow = {
  productId: string;
  sku: string;
  sarimaSourceProductId: string;
  name: string;
  expectedBarcode: string;
  actualBarcode: string | null;
  reviewStatePreserved: boolean;
  sarimaMappingPreserved: boolean;
  status: "VERIFIED" | "DISCREPANCY";
  discrepancies: string[];
};

function fail(code: string, detail: string): never {
  throw new Error(`${code}: ${detail}`);
}

export function buildExistingSarimaBarcodeWriteVerification(input: {
  authorization: ExistingSarimaBarcodeEnrichmentAuthorization;
  products: ExistingSarimaBarcodeWriteVerificationProduct[];
}) {
  if (input.products.length !== input.authorization.identities.length) {
    fail(
      "EXISTING_SARIMA_BARCODE_WRITE_VERIFICATION_IDENTITY_MISMATCH",
      `expected ${input.authorization.identities.length} products, found ${input.products.length}`
    );
  }

  const productById = new Map(input.products.map((product) => [product.id, product]));

  const rows = input.authorization.identities
    .map((identity): ExistingSarimaBarcodeWriteVerificationRow => {
      const product = productById.get(identity.id);
      if (!product || product.sku !== identity.sku || product.name !== identity.name) {
        fail(
          "EXISTING_SARIMA_BARCODE_WRITE_VERIFICATION_IDENTITY_MISMATCH",
          `${identity.id} no longer matches the authorized Product identity`
        );
      }

      const discrepancies: string[] = [];
      if (product.barcode !== identity.barcode) {
        discrepancies.push(`barcode expected=${identity.barcode} actual=${product.barcode ?? "null"}`);
      }

      const reviewStatePreserved =
        product.recordSource === "IMPORT" &&
        product.status === "INACTIVE" &&
        product.dataQualityStatus === "NEEDS_REVIEW" &&
        product.isStorefrontVisible === false;
      if (!reviewStatePreserved) {
        discrepancies.push("review/inactive/hidden state changed");
      }

      const sarimaMappingPreserved = product.sarimaSourceProductId === identity.sarimaSourceProductId;
      if (!sarimaMappingPreserved) {
        discrepancies.push(
          `SARIMA mapping expected=${identity.sarimaSourceProductId} actual=${product.sarimaSourceProductId ?? "null"}`
        );
      }

      return {
        productId: product.id,
        sku: product.sku,
        sarimaSourceProductId: identity.sarimaSourceProductId,
        name: product.name,
        expectedBarcode: identity.barcode,
        actualBarcode: product.barcode,
        reviewStatePreserved,
        sarimaMappingPreserved,
        status: discrepancies.length === 0 ? "VERIFIED" : "DISCREPANCY",
        discrepancies
      };
    })
    .sort((left, right) => left.sarimaSourceProductId.localeCompare(right.sarimaSourceProductId));

  return {
    summary: {
      expectedProducts: rows.length,
      verifiedBarcodes: rows.filter((row) => row.actualBarcode === row.expectedBarcode).length,
      preservedReviewState: rows.filter((row) => row.reviewStatePreserved).length,
      preservedSarimaMappings: rows.filter((row) => row.sarimaMappingPreserved).length,
      discrepancies: rows.filter((row) => row.status === "DISCREPANCY").length
    },
    rows
  };
}
