import assert from "node:assert/strict";
import test from "node:test";

import { executeSyntheticBarcodeRehabilitation } from "../src/modules/catalog/catalog-synthetic-barcode-rehabilitation-execution.js";

type ProductRow = {
  id: string;
  sku: string;
  barcode: string | null;
  sarimaSourceMapping: { sourceProductId: string } | null;
};

const authorization = {
  identities: [
    {
      id: "p291",
      sku: "SARIMA-P291",
      sarimaSourceProductId: "P291",
      expectedCurrentBarcode: "YSB-SARIMA-P291",
      verifiedBarcode: "4806521791696"
    },
    {
      id: "p293",
      sku: "SARIMA-P293",
      sarimaSourceProductId: "P293",
      expectedCurrentBarcode: "YSB-SARIMA-P293",
      verifiedBarcode: "4800016627262"
    }
  ]
} as const;

function rows(overrides: Partial<ProductRow>[] = []): ProductRow[] {
  const base: ProductRow[] = [
    {
      id: "p291",
      sku: "SARIMA-P291",
      barcode: "YSB-SARIMA-P291",
      sarimaSourceMapping: { sourceProductId: "P291" }
    },
    {
      id: "p293",
      sku: "SARIMA-P293",
      barcode: "YSB-SARIMA-P293",
      sarimaSourceMapping: { sourceProductId: "P293" }
    }
  ];

  return base.map((row, index) => ({ ...row, ...(overrides[index] ?? {}) }));
}

function fakeClient(
  productRows: ProductRow[],
  collisionRows: Array<{ id: string; sku: string; barcode: string }> = []
) {
  const updateCalls: unknown[] = [];
  let findIndex = 0;

  const tx = {
    product: {
      async findMany() {
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
    updateCalls
  };
}

test("replaces only the expected synthetic barcode and preserves Product/SARIMA identity", async () => {
  const { client, updateCalls } = fakeClient(rows());
  const result = await executeSyntheticBarcodeRehabilitation({ client, authorization });

  assert.deepEqual(updateCalls, [
    {
      where: {
        id: "p291",
        sku: "SARIMA-P291",
        barcode: "YSB-SARIMA-P291",
        sarimaSourceMapping: { is: { sourceProductId: "P291" } }
      },
      data: { barcode: "4806521791696" }
    },
    {
      where: {
        id: "p293",
        sku: "SARIMA-P293",
        barcode: "YSB-SARIMA-P293",
        sarimaSourceMapping: { is: { sourceProductId: "P293" } }
      },
      data: { barcode: "4800016627262" }
    }
  ]);

  assert.deepEqual(result.summary, {
    updatedBarcodes: 2,
    preservedProductIds: 2,
    preservedSarimaMappings: 2
  });
});

test("rejects an invalid GTIN before any database work", async () => {
  const { client, updateCalls } = fakeClient(rows());
  const badAuthorization = {
    identities: [
      {
        ...authorization.identities[0],
        verifiedBarcode: "4806521791695"
      }
    ]
  } as const;

  await assert.rejects(
    () => executeSyntheticBarcodeRehabilitation({ client, authorization: badAuthorization }),
    /SYNTHETIC_BARCODE_REHABILITATION_INVALID_GTIN/
  );
  assert.deepEqual(updateCalls, []);
});

test("rejects target drift when the current barcode is no longer the expected YSB value", async () => {
  const { client, updateCalls } = fakeClient(rows([{ barcode: "4806521791696" }]));

  await assert.rejects(
    () => executeSyntheticBarcodeRehabilitation({ client, authorization }),
    /SYNTHETIC_BARCODE_REHABILITATION_STATE_MISMATCH/
  );
  assert.deepEqual(updateCalls, []);
});

test("rejects Product/SARIMA identity drift", async () => {
  const { client, updateCalls } = fakeClient(
    rows([{ sarimaSourceMapping: { sourceProductId: "P999" } }])
  );

  await assert.rejects(
    () => executeSyntheticBarcodeRehabilitation({ client, authorization }),
    /SYNTHETIC_BARCODE_REHABILITATION_IDENTITY_MISMATCH/
  );
  assert.deepEqual(updateCalls, []);
});

test("rejects a verified barcode already owned by another Product", async () => {
  const { client, updateCalls } = fakeClient(rows(), [
    { id: "other", sku: "OTHER", barcode: "4806521791696" }
  ]);

  await assert.rejects(
    () => executeSyntheticBarcodeRehabilitation({ client, authorization }),
    /SYNTHETIC_BARCODE_REHABILITATION_COLLISION/
  );
  assert.deepEqual(updateCalls, []);
});

test("aborts when a conditional update does not affect exactly one row", async () => {
  const productRows = rows();
  let findIndex = 0;
  let updateIndex = 0;

  const tx = {
    product: {
      async findMany() {
        findIndex += 1;
        return findIndex === 1 ? productRows : [];
      },
      async updateMany() {
        updateIndex += 1;
        return { count: updateIndex === 1 ? 1 : 0 };
      }
    }
  };

  const client = {
    async $transaction<T>(callback: (transaction: typeof tx) => Promise<T>): Promise<T> {
      return callback(tx);
    }
  };

  await assert.rejects(
    () => executeSyntheticBarcodeRehabilitation({ client, authorization }),
    /SYNTHETIC_BARCODE_REHABILITATION_WRITE_MISMATCH/
  );
});
