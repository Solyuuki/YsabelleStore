export type SyntheticBarcodeRehabilitationAuthorization = {
  identities: readonly {
    id: string;
    sku: string;
    sarimaSourceProductId: string;
    expectedCurrentBarcode: string;
    verifiedBarcode: string;
  }[];
};

type TargetProductRow = {
  id: string;
  sku: string;
  barcode: string | null;
  sarimaSourceMapping: { sourceProductId: string } | null;
};

type BarcodeOwnerRow = {
  id: string;
  sku: string;
  barcode: string;
};

type TransactionClient = {
  product: {
    findMany(args: unknown): Promise<TargetProductRow[] | BarcodeOwnerRow[]>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
};

export type SyntheticBarcodeRehabilitationClient = {
  $transaction<T>(callback: (transaction: TransactionClient) => Promise<T>): Promise<T>;
};

function fail(code: string, detail: string): never {
  throw new Error(`${code}: ${detail}`);
}

function hasValidGs1CheckDigit(value: string): boolean {
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value)) return false;

  const digits = value.split("").map(Number);
  const expected = digits.pop();
  let sum = 0;
  let weight = 3;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    const digit = digits[index];
    if (digit === undefined) return false;
    sum += digit * weight;
    weight = weight === 3 ? 1 : 3;
  }

  return (10 - (sum % 10)) % 10 === expected;
}

function assertAuthorization(authorization: SyntheticBarcodeRehabilitationAuthorization) {
  if (authorization.identities.length === 0) {
    fail("SYNTHETIC_BARCODE_REHABILITATION_AUTHORIZATION_MISMATCH", "authorization is empty");
  }

  const ids = new Set<string>();
  const skus = new Set<string>();
  const sourceIds = new Set<string>();
  const expectedBarcodes = new Set<string>();
  const verifiedBarcodes = new Set<string>();

  for (const identity of authorization.identities) {
    const expectedSku = `SARIMA-${identity.sarimaSourceProductId}`;
    const expectedSyntheticBarcode = `YSB-${identity.sku}`;

    if (
      identity.sku !== expectedSku ||
      identity.expectedCurrentBarcode !== expectedSyntheticBarcode
    ) {
      fail(
        "SYNTHETIC_BARCODE_REHABILITATION_AUTHORIZATION_MISMATCH",
        `${identity.id} does not preserve the expected SARIMA/YSB identity relationship`
      );
    }

    if (!hasValidGs1CheckDigit(identity.verifiedBarcode)) {
      fail(
        "SYNTHETIC_BARCODE_REHABILITATION_INVALID_GTIN",
        `${identity.id} has an invalid verified barcode ${identity.verifiedBarcode}`
      );
    }

    if (
      ids.has(identity.id) ||
      skus.has(identity.sku) ||
      sourceIds.has(identity.sarimaSourceProductId) ||
      expectedBarcodes.has(identity.expectedCurrentBarcode) ||
      verifiedBarcodes.has(identity.verifiedBarcode)
    ) {
      fail(
        "SYNTHETIC_BARCODE_REHABILITATION_AUTHORIZATION_MISMATCH",
        `duplicate authorization identity or barcode detected for ${identity.id}`
      );
    }

    ids.add(identity.id);
    skus.add(identity.sku);
    sourceIds.add(identity.sarimaSourceProductId);
    expectedBarcodes.add(identity.expectedCurrentBarcode);
    verifiedBarcodes.add(identity.verifiedBarcode);
  }
}

function assertTargetRows(
  rows: TargetProductRow[],
  authorization: SyntheticBarcodeRehabilitationAuthorization
) {
  if (rows.length !== authorization.identities.length) {
    fail(
      "SYNTHETIC_BARCODE_REHABILITATION_IDENTITY_MISMATCH",
      `expected ${authorization.identities.length} products, found ${rows.length}`
    );
  }

  const rowById = new Map(rows.map((row) => [row.id, row]));

  for (const identity of authorization.identities) {
    const row = rowById.get(identity.id);
    if (
      !row ||
      row.sku !== identity.sku ||
      row.sarimaSourceMapping?.sourceProductId !== identity.sarimaSourceProductId
    ) {
      fail(
        "SYNTHETIC_BARCODE_REHABILITATION_IDENTITY_MISMATCH",
        `${identity.id} no longer matches the authorized Product/SARIMA identity`
      );
    }

    if (row.barcode !== identity.expectedCurrentBarcode) {
      fail(
        "SYNTHETIC_BARCODE_REHABILITATION_STATE_MISMATCH",
        `${identity.id} expected current barcode ${identity.expectedCurrentBarcode}, found ${row.barcode}`
      );
    }
  }
}

export async function executeSyntheticBarcodeRehabilitation(input: {
  client: SyntheticBarcodeRehabilitationClient;
  authorization: SyntheticBarcodeRehabilitationAuthorization;
}) {
  assertAuthorization(input.authorization);

  return input.client.$transaction(async (tx) => {
    const ids = input.authorization.identities.map((identity) => identity.id);
    const verifiedBarcodes = input.authorization.identities.map(
      (identity) => identity.verifiedBarcode
    );

    const targetRows = (await tx.product.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        sku: true,
        barcode: true,
        sarimaSourceMapping: { select: { sourceProductId: true } }
      },
      orderBy: { id: "asc" }
    })) as TargetProductRow[];

    assertTargetRows(targetRows, input.authorization);

    const barcodeOwners = (await tx.product.findMany({
      where: { barcode: { in: verifiedBarcodes } },
      select: { id: true, sku: true, barcode: true },
      orderBy: { id: "asc" }
    })) as BarcodeOwnerRow[];

    const targetIds = new Set(ids);
    const collisions = barcodeOwners.filter((owner) => !targetIds.has(owner.id));
    if (collisions.length > 0) {
      fail(
        "SYNTHETIC_BARCODE_REHABILITATION_COLLISION",
        collisions.map((owner) => `${owner.barcode}:${owner.id}`).join(", ")
      );
    }

    for (const identity of input.authorization.identities) {
      const result = await tx.product.updateMany({
        where: {
          id: identity.id,
          sku: identity.sku,
          barcode: identity.expectedCurrentBarcode,
          sarimaSourceMapping: { is: { sourceProductId: identity.sarimaSourceProductId } }
        },
        data: { barcode: identity.verifiedBarcode }
      });

      if (result.count !== 1) {
        fail(
          "SYNTHETIC_BARCODE_REHABILITATION_WRITE_MISMATCH",
          `${identity.id} conditional barcode update affected ${result.count} rows`
        );
      }
    }

    return {
      summary: {
        updatedBarcodes: input.authorization.identities.length,
        preservedProductIds: input.authorization.identities.length,
        preservedSarimaMappings: input.authorization.identities.length
      }
    };
  });
}
