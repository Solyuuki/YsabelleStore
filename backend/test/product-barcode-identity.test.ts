import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { ProductBarcodeSource, ProductBarcodeType } from "@prisma/client";

import { prisma } from "../src/database/prismaClient.js";
import { lookupInventoryByBarcode } from "../src/services/inventoryService.js";
import { searchPosProducts } from "../src/services/posService.js";
import {
  enrollReceivingBarcode,
  listProductBarcodes,
  registerProductBarcode,
  resolveProductBarcode
} from "../src/services/productBarcodeService.js";
import { createProduct, updateProduct } from "../src/services/productService.js";
import type { CreateProductRequest } from "../src/validators/product.validators.js";
import {
  captureDatabaseFixtureScope,
  type DatabaseFixtureScope
} from "./helpers/databaseFixtureScope.js";

let categoryId = "";
let fixtureScope: DatabaseFixtureScope;

function suffix() {
  return randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase();
}

function externalBarcode(label = "MFG") {
  return `${label}-${suffix()}`;
}

function productInput(overrides: Partial<CreateProductRequest> = {}): CreateProductRequest {
  const token = suffix();
  return {
    name: `Barcode Identity QA ${token}`,
    sku: `BC-QA-${token}`,
    barcode: externalBarcode(),
    categoryId,
    unit: "PIECE",
    costPrice: "10.00",
    sellingPrice: "15.00",
    reorderLevel: 0,
    targetStockLevel: 0,
    status: "ACTIVE",
    dataQualityStatus: "NEEDS_REVIEW",
    isStorefrontVisible: false,
    ...overrides
  };
}

function assertHttpCode(code: string) {
  return (error: unknown) =>
    error instanceof Error && "code" in error && (error as { code?: string }).code === code;
}

test.before(async () => {
  fixtureScope = await captureDatabaseFixtureScope(prisma);
  const token = suffix();
  const category = await prisma.category.create({
    data: {
      name: `Barcode QA Category ${token}`,
      slug: `barcode-qa-category-${token.toLowerCase()}`,
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
  "manual product creation persists one primary manufacturer barcode and compatibility mirror",
  { concurrency: false },
  async () => {
    const barcode = externalBarcode("CREATE");
    const product = await createProduct(productInput({ barcode }));
    const registrations = await listProductBarcodes(product.id);
    const persisted = await prisma.product.findUniqueOrThrow({
      where: { id: product.id },
      select: { barcode: true }
    });

    assert.equal(product.barcode, barcode);
    assert.equal(persisted.barcode, barcode);
    assert.equal(registrations.length, 1);
    assert.equal(registrations[0]?.barcode, barcode);
    assert.equal(registrations[0]?.type, ProductBarcodeType.MANUFACTURER);
    assert.equal(registrations[0]?.source, ProductBarcodeSource.MANUAL);
    assert.equal(registrations[0]?.isPrimary, true);
  }
);

test(
  "product creation without a manufacturer barcode receives one system-managed YSB fallback",
  { concurrency: false },
  async () => {
    const product = await createProduct(productInput({ barcode: null }));
    const registrations = await listProductBarcodes(product.id);

    assert.match(product.barcode ?? "", /^YSB-/);
    assert.equal(registrations.length, 1);
    assert.equal(registrations[0]?.barcode, product.barcode);
    assert.equal(registrations[0]?.type, ProductBarcodeType.INTERNAL);
    assert.equal(registrations[0]?.source, ProductBarcodeSource.SYSTEM_INTERNAL);
    assert.equal(registrations[0]?.isPrimary, true);
  }
);

test(
  "secondary manufacturer barcode is idempotent and resolves in POS and inventory without becoming primary",
  { concurrency: false },
  async () => {
    const primaryBarcode = externalBarcode("PRIMARY");
    const aliasBarcode = externalBarcode("ALIAS");
    const product = await createProduct(productInput({ barcode: primaryBarcode }));

    const first = await registerProductBarcode({
      productId: product.id,
      barcode: aliasBarcode,
      source: ProductBarcodeSource.MANUAL,
      makePrimary: false,
      sourceReference: "barcode-identity-test"
    });
    const second = await registerProductBarcode({
      productId: product.id,
      barcode: aliasBarcode,
      source: ProductBarcodeSource.MANUAL,
      makePrimary: false,
      sourceReference: "barcode-identity-test"
    });

    assert.equal(first.created, true);
    assert.equal(second.created, false);

    const registrations = await listProductBarcodes(product.id);
    assert.equal(registrations.length, 2);
    assert.equal(registrations.filter((record) => record.isPrimary).length, 1);
    assert.equal(registrations.find((record) => record.isPrimary)?.barcode, primaryBarcode);

    const resolution = await resolveProductBarcode(aliasBarcode);
    assert.equal(resolution.found, true);
    assert.equal(resolution.product?.id, product.id);

    const pos = await searchPosProducts(aliasBarcode, { page: 1, pageSize: 10 });
    assert.equal(pos.products.length, 1);
    assert.equal(pos.products[0]?.id, product.id);
    assert.equal(pos.products[0]?.barcode, aliasBarcode);

    const inventory = await lookupInventoryByBarcode(aliasBarcode);
    assert.equal(inventory.productId, product.id);
  }
);

test(
  "manual barcode replacement promotes the new barcode but preserves the old physical identifier",
  { concurrency: false },
  async () => {
    const originalBarcode = externalBarcode("OLD");
    const replacementBarcode = externalBarcode("NEW");
    const product = await createProduct(productInput({ barcode: originalBarcode }));

    const updated = await updateProduct(product.id, { barcode: replacementBarcode });
    const registrations = await listProductBarcodes(product.id);

    assert.equal(updated.barcode, replacementBarcode);
    assert.equal(registrations.length, 2);
    assert.equal(registrations.filter((record) => record.isPrimary).length, 1);
    assert.equal(registrations.find((record) => record.isPrimary)?.barcode, replacementBarcode);
    assert.equal(registrations.some((record) => record.barcode === originalBarcode), true);

    const oldResolution = await resolveProductBarcode(originalBarcode);
    assert.equal(oldResolution.found, true);
    assert.equal(oldResolution.product?.id, product.id);
  }
);

test(
  "a barcode owned by another product is hard-blocked and cannot be reassigned",
  { concurrency: false },
  async () => {
    const protectedBarcode = externalBarcode("OWNER");
    const firstProduct = await createProduct(productInput({ barcode: protectedBarcode }));
    const secondProduct = await createProduct(productInput({ barcode: externalBarcode("OTHER") }));

    await assert.rejects(
      () =>
        registerProductBarcode({
          productId: secondProduct.id,
          barcode: protectedBarcode,
          source: ProductBarcodeSource.MANUAL,
          makePrimary: false
        }),
      assertHttpCode("PRODUCT_BARCODE_CONFLICT")
    );

    const resolution = await resolveProductBarcode(protectedBarcode);
    assert.equal(resolution.product?.id, firstProduct.id);
  }
);

test(
  "receiving requires explicit confirmation before learning an unknown manufacturer barcode",
  { concurrency: false },
  async () => {
    const product = await createProduct(productInput());
    const receivingBarcode = externalBarcode("RECV");

    await assert.rejects(
      () =>
        enrollReceivingBarcode({
          productId: product.id,
          barcode: receivingBarcode,
          confirmed: false,
          sourceReference: "receiving-qa"
        }),
      assertHttpCode("PRODUCT_BARCODE_CONFIRMATION_REQUIRED")
    );

    assert.equal(
      await prisma.productBarcode.count({ where: { barcode: receivingBarcode } }),
      0,
      "unconfirmed receiving scan must not mutate barcode identity"
    );

    const registered = await enrollReceivingBarcode({
      productId: product.id,
      barcode: receivingBarcode,
      confirmed: true,
      sourceReference: "receiving-qa"
    });

    assert.equal(registered.created, true);
    assert.equal(registered.record.source, ProductBarcodeSource.RECEIVING_SCAN);
    assert.equal(registered.record.type, ProductBarcodeType.MANUFACTURER);

    const knownScan = await enrollReceivingBarcode({
      productId: product.id,
      barcode: receivingBarcode,
      confirmed: false,
      sourceReference: "receiving-qa"
    });
    assert.equal(knownScan.created, false);
  }
);

test(
  "POS lookup never learns an unknown barcode",
  { concurrency: false },
  async () => {
    const unknownBarcode = externalBarcode("UNKNOWN");
    const beforeCount = await prisma.productBarcode.count();
    const result = await searchPosProducts(unknownBarcode, { page: 1, pageSize: 10 });
    const afterCount = await prisma.productBarcode.count();

    assert.equal(result.products.length, 0);
    assert.equal(afterCount, beforeCount);
    assert.equal(await prisma.productBarcode.count({ where: { barcode: unknownBarcode } }), 0);
  }
);

test(
  "unknown YSB values cannot be enrolled through receiving",
  { concurrency: false },
  async () => {
    const product = await createProduct(productInput());
    const unknownInternalBarcode = `YSB-NOT-ISSUED-${suffix()}`;

    await assert.rejects(
      () =>
        enrollReceivingBarcode({
          productId: product.id,
          barcode: unknownInternalBarcode,
          confirmed: true
        }),
      assertHttpCode("PRODUCT_INTERNAL_BARCODE_RESERVED")
    );
  }
);
