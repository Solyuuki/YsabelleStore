import type {
  ExistingSarimaBarcodeEvidence,
  ExistingSarimaBarcodeEvidenceRow,
  ExistingSarimaBarcodeProduct
} from "./catalog-existing-sarima-barcode-evidence.js";

export type BarcodeOwner = {
  id: string;
  sku: string;
  name: string;
  barcode: string;
};

export type ExistingSarimaBarcodeEnrichmentPreviewRow = {
  productId: string;
  sku: string;
  sarimaSourceProductId: string;
  name: string;
  proposedBarcode: string;
  status: "READY" | "BLOCKED_BARCODE_COLLISION";
  collisionProductIds: string[];
};

export type ExistingSarimaBarcodeEnrichmentPreview = {
  summary: {
    verifiedCandidates: number;
    readyToWrite: number;
    blockedBarcodeCollisions: number;
    plannedBarcodeWrites: number;
  };
  rows: ExistingSarimaBarcodeEnrichmentPreviewRow[];
};

function fail(code: string, detail: string): never {
  throw new Error(`${code}: ${detail}`);
}

function assertTargetState(product: ExistingSarimaBarcodeProduct) {
  if (
    product.recordSource !== "IMPORT" ||
    product.status !== "INACTIVE" ||
    product.dataQualityStatus !== "NEEDS_REVIEW" ||
    product.isStorefrontVisible !== false ||
    product.barcode !== null
  ) {
    fail(
      "EXISTING_SARIMA_BARCODE_ENRICHMENT_STATE_MISMATCH",
      `${product.id} must remain IMPORT + INACTIVE + NEEDS_REVIEW + hidden + barcode null during preview`
    );
  }
}

function assertEvidenceIdentity(product: ExistingSarimaBarcodeProduct, evidence: ExistingSarimaBarcodeEvidenceRow) {
  if (
    evidence.productId !== product.id ||
    evidence.sku !== product.sku ||
    evidence.sarimaSourceProductId !== product.sarimaSourceProductId ||
    evidence.name !== product.name ||
    evidence.status !== "VERIFIED_EXTERNAL" ||
    !evidence.verifiedBarcode
  ) {
    fail(
      "EXISTING_SARIMA_BARCODE_ENRICHMENT_IDENTITY_MISMATCH",
      `${product.id} verified evidence no longer matches Product identity`
    );
  }
}

export function buildExistingSarimaBarcodeEnrichmentPreview(input: {
  products: ExistingSarimaBarcodeProduct[];
  evidence: ExistingSarimaBarcodeEvidence;
  barcodeOwners: BarcodeOwner[];
}): ExistingSarimaBarcodeEnrichmentPreview {
  const verifiedRows = input.evidence.rows.filter((row) => row.status === "VERIFIED_EXTERNAL");
  const verifiedProductIds = new Set(verifiedRows.map((row) => row.productId));
  const targetProducts = input.products.filter((product) => verifiedProductIds.has(product.id));

  if (targetProducts.length !== verifiedRows.length) {
    fail(
      "EXISTING_SARIMA_BARCODE_ENRICHMENT_IDENTITY_MISMATCH",
      `verified evidence/products mismatch; verified=${verifiedRows.length}, products=${targetProducts.length}`
    );
  }

  const productById = new Map(targetProducts.map((product) => [product.id, product]));
  const evidenceById = new Map(verifiedRows.map((row) => [row.productId, row]));
  const proposalOwners = new Map<string, string[]>();

  for (const row of verifiedRows) {
    if (!row.verifiedBarcode) continue;
    const ids = proposalOwners.get(row.verifiedBarcode) ?? [];
    ids.push(row.productId);
    proposalOwners.set(row.verifiedBarcode, ids);
  }

  const databaseOwnersByBarcode = new Map<string, BarcodeOwner[]>();
  for (const owner of input.barcodeOwners) {
    const owners = databaseOwnersByBarcode.get(owner.barcode) ?? [];
    owners.push(owner);
    databaseOwnersByBarcode.set(owner.barcode, owners);
  }

  const rows = [...verifiedProductIds]
    .map((productId): ExistingSarimaBarcodeEnrichmentPreviewRow => {
      const product = productById.get(productId);
      const evidence = evidenceById.get(productId);
      if (!product || !evidence || !evidence.verifiedBarcode) {
        fail(
          "EXISTING_SARIMA_BARCODE_ENRICHMENT_IDENTITY_MISMATCH",
          `${productId} missing verified evidence or Product`
        );
      }

      assertTargetState(product);
      assertEvidenceIdentity(product, evidence);

      const databaseCollisionIds = (databaseOwnersByBarcode.get(evidence.verifiedBarcode) ?? [])
        .filter((owner) => owner.id !== product.id)
        .map((owner) => owner.id);
      const proposalCollisionIds = (proposalOwners.get(evidence.verifiedBarcode) ?? [])
        .filter((id) => id !== product.id);
      const collisionProductIds = [...new Set([...databaseCollisionIds, ...proposalCollisionIds])].sort();

      return {
        productId: product.id,
        sku: product.sku,
        sarimaSourceProductId: product.sarimaSourceProductId,
        name: product.name,
        proposedBarcode: evidence.verifiedBarcode,
        status: collisionProductIds.length > 0 ? "BLOCKED_BARCODE_COLLISION" : "READY",
        collisionProductIds
      };
    })
    .sort((left, right) => left.sarimaSourceProductId.localeCompare(right.sarimaSourceProductId));

  const readyToWrite = rows.filter((row) => row.status === "READY").length;
  const blockedBarcodeCollisions = rows.filter((row) => row.status === "BLOCKED_BARCODE_COLLISION").length;

  return {
    summary: {
      verifiedCandidates: rows.length,
      readyToWrite,
      blockedBarcodeCollisions,
      plannedBarcodeWrites: readyToWrite
    },
    rows
  };
}
