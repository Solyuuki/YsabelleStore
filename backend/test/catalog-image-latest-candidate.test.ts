import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { catalogImageStorageFallbackRoots, catalogImageStorageRoot } from "../src/config/env.js";
import { prisma } from "../src/database/prismaClient.js";
import { CatalogImageStorage } from "../src/modules/catalog-image/catalogImageStorage.js";
import { captureDatabaseFixtureScope } from "./helpers/databaseFixtureScope.js";

const storage = new CatalogImageStorage(catalogImageStorageRoot, catalogImageStorageFallbackRoots);

async function loadProductImageService() {
  return import("../src/modules/catalog-image/productImageService.js");
}

async function writeStorageKey(key: string, contents = "image") {
  const filePath = storage.resolveStorageKey(key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, Buffer.from(contents));
}

async function cleanupStoragePrefix(prefix: string) {
  await rm(storage.resolveStorageKey(prefix), { force: true, recursive: true });
}

test("latest product image candidate returns the newest readable candidate and handles empty products", async () => {
  const service = await loadProductImageService();
  assert.equal(
    typeof service.getLatestProductImageCandidate,
    "function",
    "getLatestProductImageCandidate must be implemented"
  );

  const scope = await captureDatabaseFixtureScope(prisma);
  const suffix = randomUUID().slice(0, 8);
  const storagePrefix = `candidates/latest-${suffix}`;

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

    const olderKey = `${storagePrefix}/older.webp`;
    const newerKey = `${storagePrefix}/newer.webp`;
    await writeStorageKey(olderKey, "older");
    await writeStorageKey(newerKey, "newer");

    const older = await prisma.productImageAsset.create({
      data: {
        createdAt: new Date("2026-08-22T10:00:00.000Z"),
        originalStorageKey: olderKey,
        productId: product.id,
        sourceBytes: 100,
        sourceMimeType: "image/webp"
      }
    });
    const newer = await prisma.productImageAsset.create({
      data: {
        createdAt: new Date("2026-08-22T11:00:00.000Z"),
        originalStorageKey: newerKey,
        productId: product.id,
        sourceBytes: 120,
        sourceMimeType: "image/webp"
      }
    });

    const latest = await service.getLatestProductImageCandidate(product.id);
    assert.equal(latest?.id, newer.id);
    assert.notEqual(latest?.id, older.id);
  } finally {
    await cleanupStoragePrefix(storagePrefix);
    await scope.cleanup();
  }
});

test("latest product image candidate skips a newer orphaned source file", async () => {
  const service = await loadProductImageService();
  const scope = await captureDatabaseFixtureScope(prisma);
  const suffix = randomUUID().slice(0, 8);
  const storagePrefix = `candidates/orphan-${suffix}`;

  try {
    const category = await prisma.category.create({
      data: {
        dataQualityStatus: "APPROVED",
        isActive: true,
        isStorefrontVisible: false,
        name: `Orphan Candidate ${suffix}`,
        recordSource: "TEST_FIXTURE",
        slug: `orphan-candidate-${suffix}`
      }
    });
    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        costPrice: "10",
        dataQualityStatus: "APPROVED",
        isStorefrontVisible: false,
        name: `Orphan Candidate Product ${suffix}`,
        recordSource: "TEST_FIXTURE",
        sellingPrice: "15",
        sku: `ORPHAN-CANDIDATE-${suffix}`,
        status: "ACTIVE",
        unit: "PIECE"
      }
    });

    const readableKey = `${storagePrefix}/readable.webp`;
    await writeStorageKey(readableKey, "readable");

    const readable = await prisma.productImageAsset.create({
      data: {
        createdAt: new Date("2026-08-24T10:00:00.000Z"),
        originalStorageKey: readableKey,
        productId: product.id,
        sourceBytes: 100,
        sourceMimeType: "image/webp"
      }
    });
    await prisma.productImageAsset.create({
      data: {
        createdAt: new Date("2026-08-24T11:00:00.000Z"),
        originalStorageKey: `${storagePrefix}/missing.webp`,
        productId: product.id,
        sourceBytes: 120,
        sourceMimeType: "image/webp"
      }
    });

    const latest = await service.getLatestProductImageCandidate(product.id);
    assert.equal(latest?.id, readable.id);
  } finally {
    await cleanupStoragePrefix(storagePrefix);
    await scope.cleanup();
  }
});

test("latest product image candidate skips READY candidates whose processed preview is orphaned", async () => {
  const service = await loadProductImageService();
  const scope = await captureDatabaseFixtureScope(prisma);
  const suffix = randomUUID().slice(0, 8);
  const storagePrefix = `candidates/processed-orphan-${suffix}`;

  try {
    const category = await prisma.category.create({
      data: {
        dataQualityStatus: "APPROVED",
        isActive: true,
        isStorefrontVisible: false,
        name: `Processed Orphan ${suffix}`,
        recordSource: "TEST_FIXTURE",
        slug: `processed-orphan-${suffix}`
      }
    });
    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        costPrice: "10",
        dataQualityStatus: "APPROVED",
        isStorefrontVisible: false,
        name: `Processed Orphan Product ${suffix}`,
        recordSource: "TEST_FIXTURE",
        sellingPrice: "15",
        sku: `PROCESSED-ORPHAN-${suffix}`,
        status: "ACTIVE",
        unit: "PIECE"
      }
    });

    const fallbackKey = `${storagePrefix}/fallback.webp`;
    const staleOriginalKey = `${storagePrefix}/stale-original.webp`;
    await writeStorageKey(fallbackKey, "fallback");
    await writeStorageKey(staleOriginalKey, "stale-original");

    const fallback = await prisma.productImageAsset.create({
      data: {
        createdAt: new Date("2026-08-25T10:00:00.000Z"),
        originalStorageKey: fallbackKey,
        productId: product.id,
        sourceBytes: 100,
        sourceMimeType: "image/webp"
      }
    });
    await prisma.productImageAsset.create({
      data: {
        createdAt: new Date("2026-08-25T11:00:00.000Z"),
        originalStorageKey: staleOriginalKey,
        processedStorageKey: `${storagePrefix}/missing-processed.webp`,
        processingStatus: "READY",
        qualityStatus: "APPROVED",
        productId: product.id,
        sourceBytes: 120,
        sourceMimeType: "image/webp"
      }
    });

    const latest = await service.getLatestProductImageCandidate(product.id);
    assert.equal(latest?.id, fallback.id);
  } finally {
    await cleanupStoragePrefix(storagePrefix);
    await scope.cleanup();
  }
});

test("latest product image candidate ignores rejected drafts", async () => {
  const service = await loadProductImageService();
  const scope = await captureDatabaseFixtureScope(prisma);
  const suffix = randomUUID().slice(0, 8);
  const storagePrefix = `candidates/rejected-${suffix}`;

  try {
    const category = await prisma.category.create({
      data: {
        dataQualityStatus: "APPROVED",
        isActive: true,
        isStorefrontVisible: false,
        name: `Latest Recoverable ${suffix}`,
        recordSource: "TEST_FIXTURE",
        slug: `latest-recoverable-${suffix}`
      }
    });
    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        costPrice: "10",
        dataQualityStatus: "APPROVED",
        isStorefrontVisible: false,
        name: `Latest Recoverable Product ${suffix}`,
        recordSource: "TEST_FIXTURE",
        sellingPrice: "15",
        sku: `LATEST-RECOVERABLE-${suffix}`,
        status: "ACTIVE",
        unit: "PIECE"
      }
    });

    const recoverableKey = `${storagePrefix}/recoverable.webp`;
    await writeStorageKey(recoverableKey, "recoverable");

    const recoverable = await prisma.productImageAsset.create({
      data: {
        createdAt: new Date("2026-08-23T10:00:00.000Z"),
        originalStorageKey: recoverableKey,
        productId: product.id,
        sourceBytes: 100,
        sourceMimeType: "image/webp"
      }
    });
    await prisma.productImageAsset.create({
      data: {
        createdAt: new Date("2026-08-23T11:00:00.000Z"),
        originalStorageKey: `${storagePrefix}/manual-rejected.webp`,
        productId: product.id,
        qualityStatus: "REJECTED",
        rejectedAt: new Date("2026-08-23T11:01:00.000Z"),
        sourceBytes: 110,
        sourceMimeType: "image/webp"
      }
    });
    await prisma.productImageAsset.create({
      data: {
        createdAt: new Date("2026-08-23T12:00:00.000Z"),
        originalStorageKey: `${storagePrefix}/auto-rejected.webp`,
        productId: product.id,
        qualityStatus: "REJECTED",
        sourceBytes: 120,
        sourceMimeType: "image/webp"
      }
    });

    const latest = await service.getLatestProductImageCandidate(product.id);
    assert.equal(latest?.id, recoverable.id);
  } finally {
    await cleanupStoragePrefix(storagePrefix);
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
