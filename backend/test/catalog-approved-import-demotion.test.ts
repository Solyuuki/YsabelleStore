import assert from "node:assert/strict";
import test from "node:test";

import { executeApprovedImportDemotion } from "../src/modules/catalog/catalog-approved-import-demotion.js";

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

const authorization = {
  identities: [
    {
      id: "prd-sarima-p001",
      sku: "SARIMA-P001",
      sarimaSourceProductId: "P001",
      expectedStorefrontVisible: true
    },
    {
      id: "prd-sarima-p002",
      sku: "SARIMA-P002",
      sarimaSourceProductId: "P002",
      expectedStorefrontVisible: false
    }
  ]
};

function rows(overrides: Partial<ProductRow>[] = []): ProductRow[] {
  const base: ProductRow[] = [
    {
      id: "prd-sarima-p001",
      sku: "SARIMA-P001",
      barcode: null,
      recordSource: "IMPORT",
      status: "ACTIVE",
      dataQualityStatus: "APPROVED",
      isStorefrontVisible: true,
      sarimaSourceMapping: { sourceProductId: "P001" }
    },
    {
      id: "prd-sarima-p002",
      sku: "SARIMA-P002",
      barcode: null,
      recordSource: "IMPORT",
      status: "ACTIVE",
      dataQualityStatus: "APPROVED",
      isStorefrontVisible: false,
      sarimaSourceMapping: { sourceProductId: "P002" }
    }
  ];

  return base.map((row, index) => ({ ...row, ...(overrides[index] ?? {}) }));
}

function fakeClient(productRows: ProductRow[]) {
  const updateCalls: unknown[] = [];
  let findArgs: unknown;

  const tx = {
    product: {
      async findMany(args: unknown) {
        findArgs = args;
        return productRows;
      },
      async updateMany(args: unknown) {
        updateCalls.push(args);
        return { count: productRows.length };
      }
    }
  };

  return {
    client: {
      async $transaction<T>(callback: (transaction: typeof tx) => Promise<T>): Promise<T> {
        return callback(tx);
      }
    },
    updateCalls,
    getFindArgs: () => findArgs
  };
}

test("demotion changes only the exact approved SARIMA imports to needs-review inactive hidden", async () => {
  const { client, updateCalls, getFindArgs } = fakeClient(rows());

  const result = await executeApprovedImportDemotion({ client, authorization });

  assert.deepEqual(getFindArgs(), {
    where: { id: { in: ["prd-sarima-p001", "prd-sarima-p002"] } },
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

  assert.deepEqual(updateCalls, [
    {
      where: {
        id: { in: ["prd-sarima-p001", "prd-sarima-p002"] },
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
    }
  ]);

  assert.deepEqual(result.summary, {
    demotedProducts: 2,
    storefrontRowsHidden: 1,
    preservedSarimaMappings: 2
  });
});

test("demotion aborts before update when an approved identity is missing", async () => {
  const { client, updateCalls } = fakeClient(rows().slice(0, 1));

  await assert.rejects(
    () => executeApprovedImportDemotion({ client, authorization }),
    /APPROVED_IMPORT_DEMOTION_AUTHORIZATION_MISMATCH/
  );
  assert.deepEqual(updateCalls, []);
});

test("demotion aborts if a product is no longer an IMPORT SARIMA identity", async () => {
  const changed = rows([{ recordSource: "CATALOG" }]);
  const { client, updateCalls } = fakeClient(changed);

  await assert.rejects(
    () => executeApprovedImportDemotion({ client, authorization }),
    /APPROVED_IMPORT_DEMOTION_IDENTITY_MISMATCH/
  );
  assert.deepEqual(updateCalls, []);
});

test("demotion aborts if any barcode appeared after authorization", async () => {
  const changed = rows([{ barcode: "4800000000001" }]);
  const { client, updateCalls } = fakeClient(changed);

  await assert.rejects(
    () => executeApprovedImportDemotion({ client, authorization }),
    /APPROVED_IMPORT_DEMOTION_STATE_CHANGED/
  );
  assert.deepEqual(updateCalls, []);
});

test("demotion aborts if approval or active state drifted", async () => {
  const changed = rows([{ dataQualityStatus: "NEEDS_REVIEW" }]);
  const { client, updateCalls } = fakeClient(changed);

  await assert.rejects(
    () => executeApprovedImportDemotion({ client, authorization }),
    /APPROVED_IMPORT_DEMOTION_STATE_CHANGED/
  );
  assert.deepEqual(updateCalls, []);
});

test("demotion aborts if SARIMA source mapping no longer matches", async () => {
  const changed = rows([{ sarimaSourceMapping: { sourceProductId: "P999" } }]);
  const { client, updateCalls } = fakeClient(changed);

  await assert.rejects(
    () => executeApprovedImportDemotion({ client, authorization }),
    /APPROVED_IMPORT_DEMOTION_IDENTITY_MISMATCH/
  );
  assert.deepEqual(updateCalls, []);
});

test("demotion aborts if storefront state drifted from the approved snapshot", async () => {
  const changed = rows([{ isStorefrontVisible: false }]);
  const { client, updateCalls } = fakeClient(changed);

  await assert.rejects(
    () => executeApprovedImportDemotion({ client, authorization }),
    /APPROVED_IMPORT_DEMOTION_STATE_CHANGED/
  );
  assert.deepEqual(updateCalls, []);
});
