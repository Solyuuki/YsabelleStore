import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { ProductBarcodeSource } from "@prisma/client";

import { prisma } from "../src/database/prismaClient.js";
import { registerProductBarcode } from "../src/services/productBarcodeService.js";
import { searchPosProducts } from "../src/services/posProductSearchService.js";
import { createProduct } from "../src/services/productService.js";
import type { CreateProductRequest } from "../src/validators/product.validators.js";
import {
  captureDatabaseFixtureScope,
  type DatabaseFixtureScope
} from "./helpers/databaseFixtureScope.js";

let fixtureScope: DatabaseFixtureScope;
let categoryId = "";

function token() {
  return randomUUID().replaceAll("-", "").slice(0, 14).toUpperCase();
}

function productInput(inputToken: string): CreateProductRequest {
  return {
    name: `POS Search QA ${inputToken}`,
    sku: `POS-QA-${inputToken}`,
    barcode: `4800${inputToken.slice(0, 9)}`,
    categoryId,
    unit: "PIECE",
    costPrice: "10.00",
    sellingPrice: "777.77",
    reorderLevel: 0,
    targetStockLevel: 0,
    status: "ACTIVE",
    dataQualityStatus: "NEEDS_REVIEW",
    isStorefrontVisible: false
  };
}

test.before(async () => {
  fixtureScope = await captureDatabaseFixtureScope(prisma);
  const categoryToken = token();
  const category = await prisma.category.create({
    data: {
      name: `POS Search QA Category ${categoryToken}`,
      slug: `pos-search-qa-${categoryToken.toLowerCase()}`,
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

test("POS search resolves name, SKU, primary barcode, alternate barcode, and price", async () => {
  const inputToken = token();
  const product = await createProduct(productInput(inputToken));
  const alternateBarcode = `ALT-${inputToken}`;

  await registerProductBarcode({
    productId: product.id,
    barcode: alternateBarcode,
    source: ProductBarcodeSource.MANUAL,
    makePrimary: false,
    sourceReference: "pos-search-contract-test"
  });

  const queries = [
    product.name,
    product.sku,
    product.barcode ?? "",
    alternateBarcode,
    "777.77",
    "₱777.77"
  ];

  for (const query of queries) {
    const result = await searchPosProducts(query, { page: 1, pageSize: 20 });
    assert.equal(
      result.products.some((candidate) => candidate.id === product.id),
      true,
      `expected POS search query ${query} to resolve ${product.sku}`
    );
  }
});

test("mapped source identities resolve to the canonical POS product", async () => {
  const sourceToken = token();
  const canonicalToken = token();
  const source = await createProduct(productInput(sourceToken));
  const canonical = await createProduct({
    ...productInput(canonicalToken),
    name: `Canonical POS Product ${canonicalToken}`,
    sellingPrice: "888.88"
  });

  await prisma.productCanonicalMapping.create({
    data: {
      sourceProductId: source.id,
      canonicalProductId: canonical.id,
      matchType: "MANUAL_REVIEW",
      action: "MAPPED",
      reason: "POS canonical identity regression fixture.",
      evidence: {
        test: "pos-mapped-identity"
      },
      automated: false
    }
  });

  const sourceQueries = [source.name, source.sku, source.barcode ?? ""];

  for (const query of sourceQueries) {
    const result = await searchPosProducts(query, { page: 1, pageSize: 20 });
    assert.equal(result.products.length, 1, `expected one canonical result for ${query}`);
    assert.equal(result.products[0]?.id, canonical.id, `expected ${query} to resolve canonical product`);
    assert.notEqual(result.products[0]?.id, source.id, "source duplicate must never be sold directly");
  }
});
