type CountResult = { count: number };

type ProductRow = {
  id: string;
  sku: string;
  barcode: string | null;
  recordSource: string;
  status: string;
  dataQualityStatus: string;
  isStorefrontVisible: boolean;
  sarimaSourceMapping: { sourceProductId: string } | null;
};

export type ApprovedImportDemotionIdentity = {
  id: string;
  sku: string;
  sarimaSourceProductId: string;
  expectedStorefrontVisible: boolean;
};

export type ApprovedImportDemotionAuthorization = {
  identities: readonly ApprovedImportDemotionIdentity[];
};

export type ApprovedImportDemotionTransaction = {
  product: {
    findMany(args: unknown): Promise<ProductRow[]>;
    updateMany(args: unknown): Promise<CountResult>;
  };
};

export type ApprovedImportDemotionClient = {
  $transaction<T>(callback: (tx: ApprovedImportDemotionTransaction) => Promise<T>): Promise<T>;
};

export type ApprovedImportDemotionResult = {
  summary: {
    demotedProducts: number;
    storefrontRowsHidden: number;
    preservedSarimaMappings: number;
  };
};

function fail(code: string, detail?: string): never {
  throw new Error(detail ? `${code}: ${detail}` : code);
}

function identityKey(row: { id: string; sku: string; sarimaSourceProductId: string }) {
  return `${row.id}\u0000${row.sku}\u0000${row.sarimaSourceProductId}`;
}

export async function executeApprovedImportDemotion(input: {
  client: ApprovedImportDemotionClient;
  authorization: ApprovedImportDemotionAuthorization;
}): Promise<ApprovedImportDemotionResult> {
  return input.client.$transaction(async (tx) => {
    const identities = [...input.authorization.identities];
    const ids = identities.map((row) => row.id);
    const idSet = new Set(ids);

    if (idSet.size !== ids.length) {
      fail(
        "APPROVED_IMPORT_DEMOTION_AUTHORIZATION_MISMATCH",
        "approved identities contain duplicate product ids"
      );
    }

    const rows = await tx.product.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        sku: true,
        barcode: true,
        recordSource: true,
        status: true,
        dataQualityStatus: true,
        isStorefrontVisible: true,
        sarimaSourceMapping: { select: { sourceProductId: true } }
      },
      orderBy: { id: "asc" }
    });

    if (rows.length !== identities.length) {
      fail(
        "APPROVED_IMPORT_DEMOTION_AUTHORIZATION_MISMATCH",
        `expected ${identities.length} approved products, found ${rows.length}`
      );
    }

    const expectedByKey = new Map(identities.map((row) => [identityKey(row), row]));

    let storefrontRowsHidden = 0;

    for (const row of rows) {
      const sourceProductId = row.sarimaSourceMapping?.sourceProductId ?? null;
      const expected = sourceProductId
        ? expectedByKey.get(
            identityKey({
              id: row.id,
              sku: row.sku,
              sarimaSourceProductId: sourceProductId
            })
          )
        : undefined;

      if (!expected || row.recordSource !== "IMPORT") {
        fail(
          "APPROVED_IMPORT_DEMOTION_IDENTITY_MISMATCH",
          `product ${row.id} no longer matches its approved IMPORT/SARIMA identity`
        );
      }

      if (
        row.barcode !== null ||
        row.status !== "ACTIVE" ||
        row.dataQualityStatus !== "APPROVED" ||
        row.isStorefrontVisible !== expected.expectedStorefrontVisible
      ) {
        fail(
          "APPROVED_IMPORT_DEMOTION_STATE_CHANGED",
          `product ${row.id} state changed after authorization`
        );
      }

      if (row.isStorefrontVisible) storefrontRowsHidden += 1;
    }

    const updated = await tx.product.updateMany({
      where: {
        id: { in: ids },
        recordSource: "IMPORT",
        barcode: null,
        status: "ACTIVE",
        dataQualityStatus: "APPROVED"
      },
      data: {
        dataQualityStatus: "NEEDS_REVIEW",
        status: "INACTIVE",
        isStorefrontVisible: false
      }
    });

    if (updated.count !== identities.length) {
      fail(
        "APPROVED_IMPORT_DEMOTION_AUTHORIZATION_MISMATCH",
        `expected to demote ${identities.length} products, updated ${updated.count}`
      );
    }

    return {
      summary: {
        demotedProducts: updated.count,
        storefrontRowsHidden,
        preservedSarimaMappings: identities.length
      }
    };
  });
}
