import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";

import { catalogImageStorageRoot } from "../src/config/env.js";
import { prisma } from "../src/database/prismaClient.js";
import { CatalogImageStorage } from "../src/modules/catalog-image/catalogImageStorage.js";
import { captureDatabaseFixtureScope } from "./helpers/databaseFixtureScope.js";

const storage = new CatalogImageStorage(catalogImageStorageRoot);
const actualRepositoryRoot = path.resolve(import.meta.dirname, "..", "..");

async function loadBackfillModule() {
  return import("../src/modules/catalog-image/legacyImageBackfill.js");
}

async function cleanupCandidateStorage(productId: string) {
  const candidates = await prisma.productImageAsset.findMany({
    select: { id: true },
    where: { productId }
  });

  for (const candidate of candidates) {
    await storage.removeCandidate(candidate.id);
  }
}

test("legacy image resolver accepts only an exact local product-image basename", async () => {
  const backfill = await loadBackfillModule();
  assert.equal(
    typeof backfill.resolveLegacyProductImageSource,
    "function",
    "resolveLegacyProductImageSource must be implemented"
  );

  const repositoryRoot = path.resolve("C:/repo/YsabelleStore");
  const expected = path.join(
    repositoryRoot,
    "frontend",
    "public",
    "images",
    "products",
    "originals",
    "ligo.webp"
  );

  assert.equal(
    backfill.resolveLegacyProductImageSource(repositoryRoot, "/images/products/ligo.webp"),
    expected
  );
});

test("legacy image resolver rejects unsafe, nested, remote, decorated, and CIQE URLs", async () => {
  const backfill = await loadBackfillModule();
  assert.equal(
    typeof backfill.resolveLegacyProductImageSource,
    "function",
    "resolveLegacyProductImageSource must be implemented"
  );

  const repositoryRoot = path.resolve("C:/repo/YsabelleStore");
  const rejected = [
    null,
    "",
    "/images/products/../secret.webp",
    "/images/products/nested/secret.webp",
    "/images/products/ligo.webp?cache=1",
    "/images/products/ligo.webp#preview",
    "https://example.com/ligo.webp",
    "C:/images/ligo.webp",
    "/api/storefront/product-images/image-1/card"
  ];

  for (const imageUrl of rejected) {
    assert.equal(
      backfill.resolveLegacyProductImageSource(repositoryRoot, imageUrl),
      null,
      `expected unsafe legacy URL to be rejected: ${String(imageUrl)}`
    );
  }
});

test("legacy image backfill planner marks a retained legacy source eligible", async () => {
  const backfill = await loadBackfillModule();
  assert.equal(
    typeof backfill.planLegacyProductImageBackfill,
    "function",
    "planLegacyProductImageBackfill must be implemented"
  );

  const scope = await captureDatabaseFixtureScope(prisma);
  const suffix = randomUUID().slice(0, 8);

  try {
    const category = await prisma.category.create({
      data: {
        dataQualityStatus: "APPROVED",
        isActive: true,
        isStorefrontVisible: false,
        name: `Backfill Eligible ${suffix}`,
        recordSource: "TEST_FIXTURE",
        slug: `backfill-eligible-${suffix}`
      }
    });
    const imageUrl = "/images/products/ligo-sardines-tomato-sauce-chili-added-155g.webp";
    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        costPrice: "10",
        dataQualityStatus: "APPROVED",
        imageUrl,
        isStorefrontVisible: false,
        name: `Backfill Eligible Product ${suffix}`,
        recordSource: "TEST_FIXTURE",
        sellingPrice: "15",
        sku: `BACKFILL-ELIGIBLE-${suffix}`,
        status: "ACTIVE",
        unit: "PIECE"
      }
    });

    const plan = await backfill.planLegacyProductImageBackfill({
      productId: product.id,
      repositoryRoot: actualRepositoryRoot
    });

    assert.equal(plan.length, 1);
    assert.equal(plan[0]?.productId, product.id);
    assert.equal(plan[0]?.imageUrl, imageUrl);
    assert.equal(plan[0]?.status, "ELIGIBLE");
    assert.equal(plan[0]?.reason, "RETAINED_SOURCE_FOUND");
    assert.ok(plan[0]?.sourcePath?.endsWith(path.join("originals", path.basename(imageUrl))));
  } finally {
    await scope.cleanup();
  }
});

test("legacy image backfill planner skips products with existing CIQE image history", async () => {
  const backfill = await loadBackfillModule();
  assert.equal(
    typeof backfill.planLegacyProductImageBackfill,
    "function",
    "planLegacyProductImageBackfill must be implemented"
  );

  const scope = await captureDatabaseFixtureScope(prisma);
  const suffix = randomUUID().slice(0, 8);
  let productId: string | null = null;

  try {
    const category = await prisma.category.create({
      data: {
        dataQualityStatus: "APPROVED",
        isActive: true,
        isStorefrontVisible: false,
        name: `Backfill Existing ${suffix}`,
        recordSource: "TEST_FIXTURE",
        slug: `backfill-existing-${suffix}`
      }
    });
    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        costPrice: "10",
        dataQualityStatus: "APPROVED",
        imageUrl: "/images/products/ligo-sardines-tomato-sauce-chili-added-155g.webp",
        isStorefrontVisible: false,
        name: `Backfill Existing Product ${suffix}`,
        recordSource: "TEST_FIXTURE",
        sellingPrice: "15",
        sku: `BACKFILL-EXISTING-${suffix}`,
        status: "ACTIVE",
        unit: "PIECE"
      }
    });
    productId = product.id;

    await prisma.productImageAsset.create({
      data: {
        originalStorageKey: `candidates/${suffix}/original.webp`,
        productId: product.id,
        sourceBytes: 1024,
        sourceMimeType: "image/webp"
      }
    });

    const plan = await backfill.planLegacyProductImageBackfill({
      productId: product.id,
      repositoryRoot: actualRepositoryRoot
    });

    assert.equal(plan.length, 1);
    assert.equal(plan[0]?.productId, product.id);
    assert.equal(plan[0]?.status, "SKIPPED");
    assert.equal(plan[0]?.reason, "IMAGE_ASSET_EXISTS");
    assert.equal(plan[0]?.sourcePath, undefined);
  } finally {
    if (productId) await cleanupCandidateStorage(productId);
    await scope.cleanup();
  }
});

test("legacy image backfill dry run reports eligibility without database or storage mutation", async () => {
  const backfill = await loadBackfillModule();
  assert.equal(
    typeof backfill.runLegacyProductImageBackfill,
    "function",
    "runLegacyProductImageBackfill must be implemented"
  );

  const scope = await captureDatabaseFixtureScope(prisma);
  const suffix = randomUUID().slice(0, 8);
  let productId: string | null = null;

  try {
    const category = await prisma.category.create({
      data: {
        dataQualityStatus: "APPROVED",
        isActive: true,
        isStorefrontVisible: false,
        name: `Backfill Dry Run ${suffix}`,
        recordSource: "TEST_FIXTURE",
        slug: `backfill-dry-run-${suffix}`
      }
    });
    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        costPrice: "10",
        dataQualityStatus: "APPROVED",
        imageUrl: "/images/products/ligo-sardines-tomato-sauce-chili-added-155g.webp",
        isStorefrontVisible: false,
        name: `Backfill Dry Run Product ${suffix}`,
        recordSource: "TEST_FIXTURE",
        sellingPrice: "15",
        sku: `BACKFILL-DRY-RUN-${suffix}`,
        status: "ACTIVE",
        unit: "PIECE"
      }
    });
    productId = product.id;

    const before = await prisma.productImageAsset.count({ where: { productId: product.id } });
    const result = await backfill.runLegacyProductImageBackfill({
      apply: false,
      productId: product.id,
      repositoryRoot: actualRepositoryRoot
    });
    const after = await prisma.productImageAsset.count({ where: { productId: product.id } });

    assert.equal(before, 0);
    assert.equal(after, 0);
    assert.equal(result.eligible, 1);
    assert.equal(result.processed, 0);
    assert.equal(result.skipped, 0);
  } finally {
    if (productId) await cleanupCandidateStorage(productId);
    await scope.cleanup();
  }
});

test("legacy image backfill apply creates one candidate, stays idempotent, and does not publish it", async () => {
  const backfill = await loadBackfillModule();
  assert.equal(
    typeof backfill.runLegacyProductImageBackfill,
    "function",
    "runLegacyProductImageBackfill must be implemented"
  );

  const scope = await captureDatabaseFixtureScope(prisma);
  const suffix = randomUUID().slice(0, 8);
  let productId: string | null = null;

  try {
    const category = await prisma.category.create({
      data: {
        dataQualityStatus: "APPROVED",
        isActive: true,
        isStorefrontVisible: false,
        name: `Backfill Apply ${suffix}`,
        recordSource: "TEST_FIXTURE",
        slug: `backfill-apply-${suffix}`
      }
    });
    const legacyImageUrl = "/images/products/ligo-sardines-tomato-sauce-chili-added-155g.webp";
    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        costPrice: "10",
        dataQualityStatus: "APPROVED",
        imageUrl: legacyImageUrl,
        isStorefrontVisible: false,
        name: `Backfill Apply Product ${suffix}`,
        recordSource: "TEST_FIXTURE",
        sellingPrice: "15",
        sku: `BACKFILL-APPLY-${suffix}`,
        status: "ACTIVE",
        unit: "PIECE"
      }
    });
    productId = product.id;

    const first = await backfill.runLegacyProductImageBackfill({
      apply: true,
      productId: product.id,
      repositoryRoot: actualRepositoryRoot
    });
    const afterFirst = await prisma.productImageAsset.findMany({
      where: { productId: product.id }
    });
    const reloadedAfterFirst = await prisma.product.findUniqueOrThrow({
      where: { id: product.id }
    });

    assert.equal(first.eligible, 1);
    assert.equal(first.processed, 1);
    assert.equal(afterFirst.length, 1);
    assert.equal(reloadedAfterFirst.imageUrl, legacyImageUrl);
    assert.equal(reloadedAfterFirst.activeImageAssetId, null);

    const second = await backfill.runLegacyProductImageBackfill({
      apply: true,
      productId: product.id,
      repositoryRoot: actualRepositoryRoot
    });
    const afterSecond = await prisma.productImageAsset.count({
      where: { productId: product.id }
    });

    assert.equal(afterSecond, 1);
    assert.equal(second.processed, 0);
    assert.equal(second.skipped, 1);
  } finally {
    if (productId) await cleanupCandidateStorage(productId);
    await scope.cleanup();
  }
});
