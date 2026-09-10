import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { ProductBarcodeSource } from "@prisma/client";

import { prisma } from "../src/database/prismaClient.js";
import { receiveStock } from "../src/services/receivingStockService.js";
import { createProduct } from "../src/services/productService.js";
import type { CreateProductRequest } from "../src/validators/product.validators.js";
import {
  captureDatabaseFixtureScope,
  type DatabaseFixtureScope
} from "./helpers/databaseFixtureScope.js";

let categoryId = "";
let fixtureScope: DatabaseFixtureScope;

function token() {
  return randomUUID().replaceAll("-", "").slice(0, 14).toUpperCase();
}

function productInput(barcode: string): CreateProductRequest {
  const value = token();
  return {
    name: `Receiving Atomic QA ${value}`,
    sku: `RECV-QA-${value}`,
    barcode,
    categoryId,
    unit: "PIECE",
    costPrice: "10.00",
    sellingPrice: "15.00",
    reorderLevel: 0,
    targetStockLevel: 0,
    status: "ACTIVE",
    dataQualityStatus: "NEEDS_REVIEW",
    isStorefrontVisible: false
  };
}

function assertHttpCode(code: string) {
  return (error: unknown) =>
    error instanceof Error && "code" in error && (error as { code?: string }).code === code;
}

test.before(async () => {
  fixtureScope = await captureDatabaseFixtureScope(prisma);
  const value = token();
  const category = await prisma.category.create({
    data: {
      name: `Receiving QA Category ${value}`,
      slug: `receiving-qa-category-${value.toLowerCase()}`,
      recordSource: "CATALOG",
      dataQualityStatus: "APPROVED",
      isActive: true,
      isStorefrontVisible: true
    }
  });
  categoryId = category.id;
});

test.after(async () => {
  await fixtureScope.cleanup();
  await prisma.$disconnect();
});

test(
  "unconfirmed unknown receiving barcode rolls back barcode and stock changes together",
  { concurrency: false },
  async () => {
    const product = await createProduct(productInput(`PRIMARY-${token()}`));
    const scannedBarcode = `NEW-${token()}`;
    const batchCode = `BATCH-${token()}`;

    await assert.rejects(
      () =>
        receiveStock(product.id, {
          quantity: 5,
          batchCode,
          scannedBarcode,
          confirmNewBarcode: false
        }),
      assertHttpCode("PRODUCT_BARCODE_CONFIRMATION_REQUIRED")
    );

    const [inventory, registrationCount, batchCount, movementCount] = await Promise.all([
      prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } }),
      prisma.productBarcode.count({ where: { barcode: scannedBarcode } }),
      prisma.inventoryBatch.count({ where: { productId: product.id, batchCode } }),
      prisma.inventoryMovement.count({
        where: { productId: product.id, referenceType: "MANUAL_STOCK_IN" }
      })
    ]);

    assert.equal(inventory.quantityOnHand, 0);
    assert.equal(registrationCount, 0);
    assert.equal(batchCount, 0);
    assert.equal(movementCount, 0);
  }
);

test(
  "confirmed unknown receiving barcode registers identity and stock in one transaction",
  { concurrency: false },
  async () => {
    const product = await createProduct(productInput(`PRIMARY-${token()}`));
    const scannedBarcode = `000${token()}`;
    const firstBatch = `BATCH-${token()}`;

    const received = await receiveStock(product.id, {
      quantity: 5,
      batchCode: firstBatch,
      scannedBarcode,
      confirmNewBarcode: true
    });

    const registration = await prisma.productBarcode.findUniqueOrThrow({
      where: { barcode: scannedBarcode }
    });

    assert.equal(received.inventory.currentQuantity, 5);
    assert.equal(received.movement.type, "STOCK_IN");
    assert.equal(registration.productId, product.id);
    assert.equal(registration.barcode, scannedBarcode, "leading zeroes must be preserved");
    assert.equal(registration.source, ProductBarcodeSource.RECEIVING_SCAN);

    const second = await receiveStock(product.id, {
      quantity: 2,
      batchCode: `BATCH-${token()}`,
      scannedBarcode,
      confirmNewBarcode: false
    });

    assert.equal(second.inventory.currentQuantity, 7);
    assert.equal(await prisma.productBarcode.count({ where: { barcode: scannedBarcode } }), 1);
  }
);

test(
  "receiving a barcode owned by another product hard-blocks before stock mutation",
  { concurrency: false },
  async () => {
    const protectedBarcode = `OWNER-${token()}`;
    const ownerProduct = await createProduct(productInput(protectedBarcode));
    const targetProduct = await createProduct(productInput(`TARGET-${token()}`));
    const batchCode = `BLOCKED-${token()}`;

    await assert.rejects(
      () =>
        receiveStock(targetProduct.id, {
          quantity: 4,
          batchCode,
          scannedBarcode: protectedBarcode,
          confirmNewBarcode: true
        }),
      assertHttpCode("PRODUCT_BARCODE_CONFLICT")
    );

    const [targetInventory, batchCount, registration] = await Promise.all([
      prisma.inventory.findUniqueOrThrow({ where: { productId: targetProduct.id } }),
      prisma.inventoryBatch.count({ where: { productId: targetProduct.id, batchCode } }),
      prisma.productBarcode.findUniqueOrThrow({ where: { barcode: protectedBarcode } })
    ]);

    assert.equal(targetInventory.quantityOnHand, 0);
    assert.equal(batchCount, 0);
    assert.equal(registration.productId, ownerProduct.id);
  }
);
