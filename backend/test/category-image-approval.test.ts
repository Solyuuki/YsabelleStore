import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import {
  approveCategoryImageCandidate,
  removeActiveCategoryCover
} from "../src/modules/catalog-image/categoryImageService.js";
import { captureDatabaseFixtureScope } from "./helpers/databaseFixtureScope.js";

async function createCategoryWithApprovedCover() {
  const suffix = randomUUID().slice(0, 8);
  const category = await prisma.category.create({
    data: {
      coverStatus: "READY",
      dataQualityStatus: "APPROVED",
      isActive: true,
      isStorefrontVisible: true,
      name: `Category Cover ${suffix}`,
      recordSource: "CATALOG",
      slug: `category-cover-${suffix}`
    }
  });
  const first = await prisma.categoryImageAsset.create({
    data: {
      categoryId: category.id,
      coverStorageKey: `category-candidates/${suffix}-a/processed/cover.webp`,
      originalStorageKey: `category-candidates/${suffix}-a/original.png`,
      processedStorageKey: `category-candidates/${suffix}-a/processed/processed.webp`,
      processingStatus: "READY",
      qualityStatus: "APPROVED",
      sourceBytes: 2048,
      sourceHeight: 900,
      sourceMimeType: "image/png",
      sourceWidth: 1400,
      thumbnailStorageKey: `category-candidates/${suffix}-a/processed/thumbnail.webp`
    }
  });
  await prisma.category.update({
    data: { activeCoverAssetId: first.id },
    where: { id: category.id }
  });
  return { category, first, suffix };
}

test("category cover replacement requires an approved ready candidate", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);
  try {
    const { category, first, suffix } = await createCategoryWithApprovedCover();
    const replacement = await prisma.categoryImageAsset.create({
      data: {
        categoryId: category.id,
        coverStorageKey: `category-candidates/${suffix}-b/processed/cover.webp`,
        originalStorageKey: `category-candidates/${suffix}-b/original.png`,
        processedStorageKey: `category-candidates/${suffix}-b/processed/processed.webp`,
        processingStatus: "READY",
        qualityStatus: "NEEDS_REVIEW",
        sourceBytes: 2048,
        sourceHeight: 900,
        sourceMimeType: "image/png",
        sourceWidth: 1400,
        thumbnailStorageKey: `category-candidates/${suffix}-b/processed/thumbnail.webp`
      }
    });

    await assert.rejects(
      () => approveCategoryImageCandidate(category.id, replacement.id),
      (error) =>
        error instanceof Error &&
        (error as { code?: string }).code === "CATEGORY_COVER_NOT_APPROVABLE"
    );

    const reloaded = await prisma.category.findUniqueOrThrow({ where: { id: category.id } });
    assert.equal(reloaded.activeCoverAssetId, first.id);
  } finally {
    await scope.cleanup();
  }
});

test("approved category cover replacement is atomic and removable", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);
  try {
    const { category, first, suffix } = await createCategoryWithApprovedCover();
    const replacement = await prisma.categoryImageAsset.create({
      data: {
        categoryId: category.id,
        coverStorageKey: `category-candidates/${suffix}-c/processed/cover.webp`,
        originalStorageKey: `category-candidates/${suffix}-c/original.png`,
        processedStorageKey: `category-candidates/${suffix}-c/processed/processed.webp`,
        processingStatus: "READY",
        qualityStatus: "APPROVED",
        sourceBytes: 2048,
        sourceHeight: 900,
        sourceMimeType: "image/png",
        sourceWidth: 1400,
        thumbnailStorageKey: `category-candidates/${suffix}-c/processed/thumbnail.webp`
      }
    });

    await approveCategoryImageCandidate(category.id, replacement.id);
    const active = await prisma.category.findUniqueOrThrow({ where: { id: category.id } });
    const previous = await prisma.categoryImageAsset.findUniqueOrThrow({ where: { id: first.id } });

    assert.equal(active.activeCoverAssetId, replacement.id);
    assert.equal(active.coverStatus, "READY");
    assert.ok(previous.supersededAt instanceof Date);

    await removeActiveCategoryCover(category.id);
    const removed = await prisma.category.findUniqueOrThrow({ where: { id: category.id } });
    assert.equal(removed.activeCoverAssetId, null);
    assert.equal(removed.coverStatus, "MISSING");
  } finally {
    await scope.cleanup();
  }
});
