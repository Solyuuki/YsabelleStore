import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import { captureDatabaseFixtureScope } from "./helpers/databaseFixtureScope.js";

async function loadProductImageService() {
  return import("../src/modules/catalog-image/productImageService.js");
}

test("latest product image candidate returns the newest candidate and handles empty products", async () => {
  const service = await loadProductImageService();
  assert.equal(
    typeof service.getLatestProductImageCandidate,
    "function",
    "getLatestProductImageCandidate must be implemented"
  );

  const scope = await captureDatabaseFixtureScope(prisma);
  const suffix = randomUUID().slice(0, 8);

  try {
    const category = await prisma.category.create({
      data: {
        dataQualityStatus: "APPROVED",
        isActive: true,
        isStorefrontVisible: false,
        name: `Latest Candidate ${suffix}`,
        recordSource: "TEST_FIXTURE",
        slug: `latest-candidate-${suffix}`
      }
    });
    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        costPrice: "10",
        dataQualityStatus: "APPROVED",
        isStorefrontVisible: false,
        name: `Latest Candidate Product ${suffix}`,
        recordSource: "TEST_FIXTURE",
        sellingPrice: "15",
        sku: `LATEST-CANDIDATE-${suffix}`,
        status: "ACTIVE",
        unit: "PIECE"
      }
    });

    assert.equal(await service.getLatestProductImageCandidate(product.id), null);

    const older = await prisma.productImageAsset.create({
      data: {
        createdAt: new Date("2026-08-22T10:00:00.000Z"),
        originalStorageKey: `candidates/${suffix}/older.webp`,
        productId: product.id,
        sourceBytes: 100,
        sourceMimeType: "image/webp"
      }
    });
    const newer = await prisma.productImageAsset.create({
      data: {
        createdAt: new Date("2026-08-22T11:00:00.000Z"),
        originalStorageKey: `candidates/${suffix}/newer.webp`,
        productId: product.id,
        sourceBytes: 120,
        sourceMimeType: "image/webp"
      }
    });

    const latest = await service.getLatestProductImageCandidate(product.id);
    assert.equal(latest?.id, newer.id);
    assert.notEqual(latest?.id, older.id);
  } finally {
    await scope.cleanup();
  }
});

test("latest product image candidate rejects an unknown product", async () => {
  const service = await loadProductImageService();
  assert.equal(
    typeof service.getLatestProductImageCandidate,
    "function",
    "getLatestProductImageCandidate must be implemented"
  );

  await assert.rejects(
    service.getLatestProductImageCandidate(`missing-${randomUUID()}`),
    (error: unknown) =>
      error instanceof Error && (error as { code?: string }).code === "PRODUCT_NOT_FOUND"
  );
});
