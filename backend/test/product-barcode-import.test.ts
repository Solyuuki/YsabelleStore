import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { ProductBarcodeSource, ProductBarcodeType } from "@prisma/client";

import { prisma } from "../src/database/prismaClient.js";
import { importProductsFromFile } from "../src/services/productImportService.js";
import {
  captureDatabaseFixtureScope,
  type DatabaseFixtureScope
} from "./helpers/databaseFixtureScope.js";

let fixtureScope: DatabaseFixtureScope;

function token() {
  return randomUUID().replaceAll("-", "").slice(0, 14).toUpperCase();
}

test.before(async () => {
  fixtureScope = await captureDatabaseFixtureScope(prisma);
});

test.after(async () => {
  await fixtureScope.cleanup();
  await prisma.$disconnect();
});

test(
  "bulk import dual-writes manufacturer identities and allocates internal fallback when barcode is absent",
  { concurrency: false },
  async () => {
    const value = token();
    const categoryName = `Barcode Import QA ${value}`;
    const category = await prisma.category.create({
      data: {
        name: categoryName,
        slug: `barcode-import-qa-${value.toLowerCase()}`,
        recordSource: "CATALOG",
        dataQualityStatus: "APPROVED",
        isActive: true,
        isStorefrontVisible: true
      }
    });

    const manufacturerSku = `IMP-MFG-${value}`;
    const internalSku = `IMP-INT-${value}`;
    const manufacturerBarcode = `000${value}`;
    const headers = [
      "name",
      "sku",
      "barcode",
      "category",
      "unit",
      "costPrice",
      "sellingPrice",
      "reorderLevel",
      "targetStockLevel",
      "initialStock",
      "status",
      "description",
      "imageUrl"
    ].join(",");
    const manufacturerRow = [
      `Barcode Import Manufacturer ${value}`,
      manufacturerSku,
      manufacturerBarcode,
      categoryName,
      "PIECE",
      "10.00",
      "15.00",
      "0",
      "0",
      "0",
      "ACTIVE",
      "",
      ""
    ].join(",");
    const internalRow = [
      `Barcode Import Internal ${value}`,
      internalSku,
      "",
      categoryName,
      "PIECE",
      "10.00",
      "15.00",
      "0",
      "0",
      "0",
      "ACTIVE",
      "",
      ""
    ].join(",");

    const summary = await importProductsFromFile({
      originalname: `barcode-import-${value}.csv`,
      mimetype: "text/csv",
      buffer: Buffer.from(`${headers}\n${manufacturerRow}\n${internalRow}\n`, "utf8")
    });

    assert.equal(summary.importedRows, 2);

    const [manufacturerProduct, internalProduct] = await Promise.all([
      prisma.product.findUniqueOrThrow({
        where: { sku: manufacturerSku },
        include: { barcodes: true }
      }),
      prisma.product.findUniqueOrThrow({
        where: { sku: internalSku },
        include: { barcodes: true }
      })
    ]);

    assert.equal(manufacturerProduct.barcode, manufacturerBarcode);
    assert.equal(manufacturerProduct.barcodes.length, 1);
    assert.equal(manufacturerProduct.barcodes[0]?.barcode, manufacturerBarcode);
    assert.equal(manufacturerProduct.barcodes[0]?.type, ProductBarcodeType.MANUFACTURER);
    assert.equal(manufacturerProduct.barcodes[0]?.source, ProductBarcodeSource.IMPORT);
    assert.equal(manufacturerProduct.barcodes[0]?.isPrimary, true);

    assert.match(internalProduct.barcode ?? "", /^YSB-/);
    assert.equal(internalProduct.barcodes.length, 1);
    assert.equal(internalProduct.barcodes[0]?.barcode, internalProduct.barcode);
    assert.equal(internalProduct.barcodes[0]?.type, ProductBarcodeType.INTERNAL);
    assert.equal(internalProduct.barcodes[0]?.source, ProductBarcodeSource.SYSTEM_INTERNAL);
    assert.equal(internalProduct.barcodes[0]?.isPrimary, true);

    assert.equal(category.id.length > 0, true);
  }
);
