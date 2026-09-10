import assert from "node:assert/strict";
import test from "node:test";

import { executeExistingSarimaBarcodeEnrichment } from "../src/modules/catalog/catalog-existing-sarima-barcode-enrichment-execution.js";

type ProductRow = {
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

function rows(overrides: Partial<ProductRow>[] = []): ProductRow[] {
  const base: ProductRow[] = [
    {
      id: "p1",
      sku: "SARIMA-P022",
      name: "Gardenia Enriched White Bread 600g",
      barcode: null,
      recordSource: "IMPORT",
      status: "INACTIVE",
      dataQualityStatus: "NEEDS_REVIEW",
      isStorefrontVisible: false,
      sarimaSourceMapping: { sourceProductId: "P022" }
    },
    {
      id: "p2",
      sku: "SARIMA-P088",
      name: "Fresca Tuna Flakes in Oil 175g",
      barcode: null,
      recordSource: "IMPORT",
      status: "INACTIVE",
      dataQualityStatus: "NEEDS_REVIEW",
      isStorefrontVisible: false,
      sarimaSourceMapping: { sourceProductId: "P088" }
    }
  ];
  return base.map((row, index) => ({ ...row, ...(overrides[index] ?? {}) }));
}

function fakeClient(
  productRows: ProductRow[],
  collisionRows: Array<{ id: string; sku: string; name: string; barcode: string }> = []
) {
  const updateCalls: unknown[] = [];
  const findCalls: unknown[] = [];
  let findIndex = 0;

  const tx = {
    product: {
      async findMany(args: unknown) {
        findCalls.push(args);
        findIndex += 1;
        return findIndex === 1 ? productRows : collisionRows;
      },
      async updateMany(args: unknown) {
        updateCalls.push(args);
        return { count: 1 };
      }
    }
  };

  return {
    client: {
      async $transaction<T>(callback: (transaction: typeof tx) => Promise<T>): Promise<T> {
        return callback(tx);
      }
    },
    findCalls,
    updateCalls
  };
}

test("writes only the authorized barcode while preserving review/inactive/hidden state", async () => {
  const { client, updateCalls } = fakeClient(rows());

  const result = await executeExistingSarimaBarcodeEnrichment({ client, authorization });

  assert.deepEqual(updateCalls, [
    {
      where: {
        id: "p1",
        sku: "SARIMA-P022",
        barcode: null,
        recordSource: "IMPORT",
        status: "INACTIVE",
        dataQualityStatus: "NEEDS_REVIEW",
        isStorefrontVisible: false
      },
      data: { barcode: "4806502720615" }
    },
    {
      where: {
        id: "p2",
        sku: "SARIMA-P088",
        barcode: null,
        recordSource: "IMPORT",
        status: "INACTIVE",
        dataQualityStatus: "NEEDS_REVIEW",
        isStorefrontVisible: false
      },
      data: { barcode: "748485900094" }
    }
  ]);
  assert.deepEqual(result.summary, { updatedBarcodes: 2, preservedSarimaMappings: 2 });
});

test("aborts before writes if any target state drifted", async () => {
  const { client, updateCalls } = fakeClient(rows([{ status: "ACTIVE" }]));
  await assert.rejects(
    () => executeExistingSarimaBarcodeEnrichment({ client, authorization }),
    /EXISTING_SARIMA_BARCODE_ENRICHMENT_STATE_MISMATCH/
  );
  assert.deepEqual(updateCalls, []);
});

test("aborts before writes if Product/SARIMA identity drifted", async () => {
  const { client, updateCalls } = fakeClient(
    rows([{ sarimaSourceMapping: { sourceProductId: "P999" } }])
  );
  await assert.rejects(
    () => executeExistingSarimaBarcodeEnrichment({ client, authorization }),
    /EXISTING_SARIMA_BARCODE_ENRICHMENT_IDENTITY_MISMATCH/
  );
  assert.deepEqual(updateCalls, []);
});

test("aborts before writes if any authorized barcode is owned by another Product", async () => {
  const { client, updateCalls } = fakeClient(rows(), [
    { id: "other", sku: "OTHER", name: "Other Product", barcode: "4806502720615" }
  ]);
  await assert.rejects(
    () => executeExistingSarimaBarcodeEnrichment({ client, authorization }),
    /EXISTING_SARIMA_BARCODE_ENRICHMENT_COLLISION/
  );
  assert.deepEqual(updateCalls, []);
});

test("aborts and rolls back when any conditional barcode update does not affect exactly one row", async () => {
  const productRows = rows();
  const updateCalls: unknown[] = [];
  const tx = {
    product: {
      async findMany(args: unknown) {
        if ((args as { select?: { sarimaSourceMapping?: unknown } }).select?.sarimaSourceMapping)
          return productRows;
        return [];
      },
      async updateMany(args: unknown) {
        updateCalls.push(args);
        return { count: updateCalls.length === 1 ? 1 : 0 };
      }
    }
  };
  const client = {
    async $transaction<T>(callback: (transaction: typeof tx) => Promise<T>): Promise<T> {
      return callback(tx);
    }
  };

  await assert.rejects(
    () => executeExistingSarimaBarcodeEnrichment({ client, authorization }),
    /EXISTING_SARIMA_BARCODE_ENRICHMENT_WRITE_MISMATCH/
  );
});
