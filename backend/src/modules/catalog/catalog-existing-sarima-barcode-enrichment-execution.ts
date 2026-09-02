export type ExistingSarimaBarcodeEnrichmentAuthorization = {
  identities: readonly {
    id: string;
    sku: string;
    name: string;
    sarimaSourceProductId: string;
    barcode: string;
  }[];
};

type TargetProductRow = {
  id: string;
  sku: string;
  name: string;
  barcode: string | null;
  recordSource: string;
  status: string;
  dataQualityStatus: string;
  isStorefrontVisible: boolean;
  sarimaSourceMapping: { sourceProductId: string } | null;
};

type BarcodeOwnerRow = {
  id: string;
  sku: string;
  name: string;
  barcode: string;
};

type TransactionClient = {
  product: {
    findMany(args: unknown): Promise<TargetProductRow[] | BarcodeOwnerRow[]>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
};

export type ExistingSarimaBarcodeEnrichmentClient = {
  $transaction<T>(callback: (transaction: TransactionClient) => Promise<T>): Promise<T>;
};

function fail(code: string, detail: string): never {
  throw new Error(`${code}: ${detail}`);
}

function assertAuthorization(authorization: ExistingSarimaBarcodeEnrichmentAuthorization) {
  if (authorization.identities.length === 0) {
    fail("EXISTING_SARIMA_BARCODE_ENRICHMENT_AUTHORIZATION_MISMATCH", "authorization is empty");
  }

  const ids = new Set<string>();
  const skus = new Set<string>();
  const sourceIds = new Set<string>();
  const barcodes = new Set<string>();

  for (const identity of authorization.identities) {
    if (
      ids.has(identity.id) ||
      skus.has(identity.sku) ||
      sourceIds.has(identity.sarimaSourceProductId) ||
      barcodes.has(identity.barcode)
    ) {
      fail(
        "EXISTING_SARIMA_BARCODE_ENRICHMENT_AUTHORIZATION_MISMATCH",
        `duplicate authorization identity or barcode detected for ${identity.id}`
      );
    }
    ids.add(identity.id);
    skus.add(identity.sku);
    sourceIds.add(identity.sarimaSourceProductId);
    barcodes.add(identity.barcode);
  }
}

function assertTargetRows(
  rows: TargetProductRow[],
  authorization: ExistingSarimaBarcodeEnrichmentAuthorization
) {
  if (rows.length !== authorization.identities.length) {
    fail(
      "EXISTING_SARIMA_BARCODE_ENRICHMENT_IDENTITY_MISMATCH",
      `expected ${authorization.identities.length} products, found ${rows.length}`
    );
  }

  const rowById = new Map(rows.map((row) => [row.id, row]));

  for (const identity of authorization.identities) {
    const row = rowById.get(identity.id);
    if (
      !row ||
      row.sku !== identity.sku ||
      row.name !== identity.name ||
      row.sarimaSourceMapping?.sourceProductId !== identity.sarimaSourceProductId
    ) {
      fail(
        "EXISTING_SARIMA_BARCODE_ENRICHMENT_IDENTITY_MISMATCH",
        `${identity.id} no longer matches the authorized Product/SARIMA identity`
      );
    }

    if (
      row.barcode !== null ||
      row.recordSource !== "IMPORT" ||
      row.status !== "INACTIVE" ||
      row.dataQualityStatus !== "NEEDS_REVIEW" ||
      row.isStorefrontVisible !== false
    ) {
      fail(
        "EXISTING_SARIMA_BARCODE_ENRICHMENT_STATE_MISMATCH",
        `${identity.id} must remain IMPORT + INACTIVE + NEEDS_REVIEW + hidden + barcode null`
      );
    }
  }
}

export async function executeExistingSarimaBarcodeEnrichment(input: {
  client: ExistingSarimaBarcodeEnrichmentClient;
  authorization: ExistingSarimaBarcodeEnrichmentAuthorization;
}) {
  assertAuthorization(input.authorization);

  return input.client.$transaction(async (tx) => {
    const ids = input.authorization.identities.map((identity) => identity.id);
    const barcodes = input.authorization.identities.map((identity) => identity.barcode);

    const targetRows = (await tx.product.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        sku: true,
        name: true,
        barcode: true,
        recordSource: true,
        status: true,
        dataQualityStatus: true,
        isStorefrontVisible: true,
        sarimaSourceMapping: { select: { sourceProductId: true } }
      },
      orderBy: { id: "asc" }
    })) as TargetProductRow[];

    assertTargetRows(targetRows, input.authorization);

    const barcodeOwners = (await tx.product.findMany({
      where: { barcode: { in: barcodes } },
      select: { id: true, sku: true, name: true, barcode: true },
      orderBy: { id: "asc" }
    })) as BarcodeOwnerRow[];

    const targetIds = new Set(ids);
    const collisions = barcodeOwners.filter((owner) => !targetIds.has(owner.id));
    if (collisions.length > 0) {
      fail(
        "EXISTING_SARIMA_BARCODE_ENRICHMENT_COLLISION",
        collisions.map((owner) => `${owner.barcode}:${owner.id}`).join(", ")
      );
    }

    for (const identity of input.authorization.identities) {
      const result = await tx.product.updateMany({
        where: {
          id: identity.id,
          sku: identity.sku,
          barcode: null,
          recordSource: "IMPORT",
          status: "INACTIVE",
          dataQualityStatus: "NEEDS_REVIEW",
          isStorefrontVisible: false
        },
        data: { barcode: identity.barcode }
      });

      if (result.count !== 1) {
        fail(
          "EXISTING_SARIMA_BARCODE_ENRICHMENT_WRITE_MISMATCH",
          `${identity.id} conditional barcode update affected ${result.count} rows`
        );
      }
    }

    return {
      summary: {
        updatedBarcodes: input.authorization.identities.length,
        preservedSarimaMappings: input.authorization.identities.length
      }
    };
  });
}
