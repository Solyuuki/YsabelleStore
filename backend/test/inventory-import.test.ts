import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import { createCategory, createProduct } from "../src/services/productService.js";
import {
  getInventoryStockImportTemplateCsv,
  importInventoryStockFromFile,
  previewInventoryStockImport
} from "../src/services/inventoryImportService.js";
import { searchPosProducts } from "../src/services/posService.js";
import {
  captureDatabaseFixtureScope,
  type DatabaseFixtureScope
} from "./helpers/databaseFixtureScope.js";

type UploadedFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

let categoryId = "";
let userId = "";
let fixtureScope: DatabaseFixtureScope;

test.before(async () => {
  fixtureScope = await captureDatabaseFixtureScope(prisma);
  const category = await createCategory({
    name: `Inventory Import ${randomUUID().slice(0, 8)}`,
    slug: `inventory-import-${randomUUID().slice(0, 8)}`
  });
  categoryId = category.id;

  const user = await prisma.user.create({
    data: {
      name: `Inventory Import Actor ${randomUUID().slice(0, 8)}`,
      email: `inventory-import-${randomUUID().slice(0, 8)}@example.com`,
      passwordHash: "hash",
      role: "OWNER"
    }
  });
  userId = user.id;
});

test.after(async () => {
  await fixtureScope.cleanup();
  await prisma.$disconnect();
});

test(
  "inventory stock import template is header-only and exact",
  { concurrency: false },
  async () => {
    assert.equal(
      getInventoryStockImportTemplateCsv(),
      "sku,barcode,quantity,batchCode,expirationDate,reason"
    );
  }
);

test("preview accepts a valid SKU row", { concurrency: false }, async () => {
  const product = await createProduct(buildProductInput());
  const preview = await previewInventoryStockImport(
    csvFile(
      "valid-sku.csv",
      [
        "sku,barcode,quantity,batchCode,expirationDate,reason",
        `${product.sku},,5,BATCH-001,2099-12-31,Stock in`
      ].join("\n")
    )
  );

  assert.equal(preview.invalidRows, 0);
  assert.equal(preview.validRows, 1);
  assert.equal(preview.rows[0]?.productId, product.id);
});

test("preview accepts a valid barcode row", { concurrency: false }, async () => {
  const product = await createProduct(buildProductInput());
  const preview = await previewInventoryStockImport(
    csvFile(
      "valid-barcode.csv",
      [
        "sku,barcode,quantity,batchCode,expirationDate,reason",
        `,${product.barcode},3,BATCH-002,2099-12-31,Stock in`
      ].join("\n")
    )
  );

  assert.equal(preview.invalidRows, 0);
  assert.equal(preview.validRows, 1);
  assert.equal(preview.rows[0]?.productId, product.id);
});

test("preview rejects missing product identifiers", { concurrency: false }, async () => {
  const preview = await previewInventoryStockImport(
    csvFile(
      "missing-identifier.csv",
      [
        "sku,barcode,quantity,batchCode,expirationDate,reason",
        `,,5,BATCH-003,2099-12-31,Stock in`
      ].join("\n")
    )
  );

  assert.ok(preview.errors.some((issue) => issue.code === "MISSING_PRODUCT_IDENTIFIER"));
});

test("preview rejects SKU and barcode mismatches", { concurrency: false }, async () => {
  const skuProduct = await createProduct(
    buildProductInput({ sku: `SKU-${randomUUID().slice(0, 8)}` })
  );
  const barcodeProduct = await createProduct(
    buildProductInput({
      sku: `SKU-${randomUUID().slice(0, 8)}`,
      barcode: `99${randomUUID().replace(/-/g, "").slice(0, 13)}`
    })
  );

  const preview = await previewInventoryStockImport(
    csvFile(
      "mismatch.csv",
      [
        "sku,barcode,quantity,batchCode,expirationDate,reason",
        `${skuProduct.sku},${barcodeProduct.barcode},2,BATCH-004,2099-12-31,Stock in`
      ].join("\n")
    )
  );

  assert.ok(preview.errors.some((issue) => issue.code === "SKU_BARCODE_MISMATCH"));
});

test(
  "import stock creates and then updates a compatible batch safely",
  { concurrency: false },
  async () => {
    const product = await createProduct(buildProductInput());
    const file = csvFile(
      "import.csv",
      [
        "sku,barcode,quantity,batchCode,expirationDate,reason",
        `${product.sku},,4,BATCH-UP,2099-12-31,Stock in`
      ].join("\n")
    );

    const firstImport = await importInventoryStockFromFile(file, userId);
    assert.equal(firstImport.importedRows, 1);
    assert.equal(firstImport.totalUnitsAdded, 4);
    assert.equal(firstImport.batchesCreated, 1);
    assert.equal(firstImport.batchesUpdated, 0);

    const secondImport = await importInventoryStockFromFile(file, userId);
    assert.equal(secondImport.importedRows, 1);
    assert.equal(secondImport.totalUnitsAdded, 4);
    assert.equal(secondImport.batchesCreated, 0);
    assert.equal(secondImport.batchesUpdated, 1);

    const state = await prisma.product.findUnique({
      include: {
        inventory: true,
        inventoryBatches: true,
        inventoryMovements: true
      },
      where: {
        id: product.id
      }
    });

    assert.ok(state?.inventory);
    assert.equal(state?.inventory?.quantityOnHand, 8);
    assert.equal(state?.inventoryBatches.length, 1);
    assert.equal(state?.inventoryBatches[0]?.quantityRemaining, 8);
    assert.equal(state?.inventoryMovements.at(-1)?.performedById, userId);
    assert.equal(state?.inventoryMovements.at(-1)?.referenceType, "INVENTORY_IMPORT");
    assert.equal(state?.inventoryMovements.at(-1)?.type, "STOCK_IN");
  }
);

test(
  "import stock keeps POS visibility and product metadata unchanged",
  { concurrency: false },
  async () => {
    const product = await createProduct(buildProductInput());
    const before = await prisma.product.findUnique({
      where: {
        id: product.id
      }
    });

    await importInventoryStockFromFile(
      csvFile(
        "pos-stock.csv",
        [
          "sku,barcode,quantity,batchCode,expirationDate,reason",
          `${product.sku},,2,BATCH-POS,2099-12-31,Stock in`
        ].join("\n")
      ),
      userId
    );

    const after = await prisma.product.findUnique({
      where: {
        id: product.id
      }
    });
    const posLookup = await searchPosProducts(product.sku, { page: 1, pageSize: 20 });

    assert.equal(after?.name, before?.name);
    assert.equal(after?.sku, before?.sku);
    assert.equal(posLookup.products.find((entry) => entry.id === product.id)?.availableStock, 2);
  }
);

function csvFile(originalname: string, csv: string): UploadedFile {
  return {
    originalname,
    mimetype: "text/csv",
    buffer: Buffer.from(csv, "utf8")
  };
}

function buildProductInput(overrides: Partial<{ sku: string; barcode: string }> = {}) {
  const suffix = randomUUID().slice(0, 8).toUpperCase();

  return {
    name: `Inventory Import Product ${suffix}`,
    sku: overrides.sku ?? `IMP-${suffix}`,
    barcode: overrides.barcode ?? `99${randomUUID().replace(/-/g, "").slice(0, 13)}`,
    categoryId,
    unit: "PIECE" as const,
    costPrice: "10.00",
    sellingPrice: "15.00",
    reorderLevel: 1,
    targetStockLevel: 5,
    status: "ACTIVE" as const
  };
}
