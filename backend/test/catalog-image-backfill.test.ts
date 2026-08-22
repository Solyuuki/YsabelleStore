import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import path from "node:path";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import { captureDatabaseFixtureScope } from "./helpers/databaseFixtureScope.js";

async function loadBackfillModule() {
  try {
    return await import("../src/modules/catalog-image/legacyImageBackfill.js");
  } catch {
    return null;
  }
}

test("legacy image resolver accepts only an exact local product-image basename", async () => {
  const backfill = await loadBackfillModule();
  assert.equal(
    typeof backfill?.resolveLegacyProductImageSource,
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
    typeof backfill?.resolveLegacyProductImageSource,
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
    typeof backfill?.planLegacyProductImageBackfill,
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
        isStorefrontVisible: true,
        name: `Backfill Eligible ${suffix}`,
        recordSource: "CATALOG",
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
        isStorefrontVisible: true,
        name: `Backfill Eligible Product ${suffix}`,
        sellingPrice: "15",
        sku: `BACKFILL-ELIGIBLE-${suffix}`,
        status: "ACTIVE",
        unit: "PIECE"
      }
    });

    const plan = await backfill.planLegacyProductImageBackfill({
      productId: product.id,
      repositoryRoot: path.resolve(".")
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
    typeof backfill?.planLegacyProductImageBackfill,
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
        isStorefrontVisible: true,
        name: `Backfill Existing ${suffix}`,
        recordSource: "CATALOG",
        slug: `backfill-existing-${suffix}`
      }
    });
    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        costPrice: "10",
        dataQualityStatus: "APPROVED",
        imageUrl: "/images/products/ligo-sardines-tomato-sauce-chili-added-155g.webp",
        isStorefrontVisible: true,
        name: `Backfill Existing Product ${suffix}`,
        sellingPrice: "15",
        sku: `BACKFILL-EXISTING-${suffix}`,
        status: "ACTIVE",
        unit: "PIECE"
      }
    });

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
      repositoryRoot: path.resolve(".")
    });

    assert.equal(plan.length, 1);
    assert.equal(plan[0]?.productId, product.id);
    assert.equal(plan[0]?.status, "SKIPPED");
    assert.equal(plan[0]?.reason, "IMAGE_ASSET_EXISTS");
    assert.equal(plan[0]?.sourcePath, undefined);
  } finally {
    await scope.cleanup();
  }
});
