import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import { approveProductImageCandidate } from "../src/modules/catalog-image/productImageService.js";
import { captureDatabaseFixtureScope } from "./helpers/databaseFixtureScope.js";

async function createProductWithApprovedImage() {
  const suffix = randomUUID().slice(0, 8);
  const category = await prisma.category.create({
    data: {
      dataQualityStatus: "APPROVED",
      isActive: true,
      isStorefrontVisible: true,
      name: `Approval Category ${suffix}`,
      recordSource: "CATALOG",
      slug: `approval-category-${suffix}`
    }
  });
  const product = await prisma.product.create({
    data: {
      categoryId: category.id,
      costPrice: "10",
      dataQualityStatus: "APPROVED",
      isStorefrontVisible: true,
      name: `Approval Product ${suffix}`,
      sellingPrice: "15",
      sku: `APPROVAL-${suffix}`,
      status: "ACTIVE",
      unit: "PIECE"
    }
  });
  const first = await prisma.productImageAsset.create({
    data: {
      cardStorageKey: `candidates/${suffix}-a/processed/card.webp`,
      originalStorageKey: `candidates/${suffix}-a/original.png`,
      pdpStorageKey: `candidates/${suffix}-a/processed/pdp.webp`,
      processedStorageKey: `candidates/${suffix}-a/processed/processed.webp`,
      processingStatus: "READY",
      productId: product.id,
      qualityStatus: "APPROVED",
      sourceBytes: 1024,
      sourceHeight: 900,
      sourceMimeType: "image/png",
      sourceWidth: 900
    }
  });
  const activeUrl = `/api/storefront/product-images/${first.id}/card`;
  await prisma.product.update({
    data: { activeImageAssetId: first.id, imageUrl: activeUrl },
    where: { id: product.id }
  });

  return { first, product, suffix };
}

test("review-required replacement cannot displace the active approved image", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);

  try {
    const { first, product, suffix } = await createProductWithApprovedImage();
    const replacement = await prisma.productImageAsset.create({
      data: {
        cardStorageKey: `candidates/${suffix}-b/processed/card.webp`,
        originalStorageKey: `candidates/${suffix}-b/original.png`,
        pdpStorageKey: `candidates/${suffix}-b/processed/pdp.webp`,
        processedStorageKey: `candidates/${suffix}-b/processed/processed.webp`,
        processingStatus: "READY",
        productId: product.id,
        qualityStatus: "NEEDS_REVIEW",
        sourceBytes: 1024,
        sourceHeight: 900,
        sourceMimeType: "image/png",
        sourceWidth: 900
      }
    });

    await assert.rejects(
      () => approveProductImageCandidate(product.id, replacement.id),
      (error) =>
        error instanceof Error &&
        (error as { code?: string }).code === "PRODUCT_IMAGE_NOT_APPROVABLE"
    );
    const reloaded = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });

    assert.equal(reloaded.activeImageAssetId, first.id);
    assert.equal(reloaded.imageUrl, `/api/storefront/product-images/${first.id}/card`);
  } finally {
    await scope.cleanup();
  }
});

test("approved ready replacement atomically becomes active and supersedes previous image", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);

  try {
    const { first, product, suffix } = await createProductWithApprovedImage();
    const replacement = await prisma.productImageAsset.create({
      data: {
        cardStorageKey: `candidates/${suffix}-c/processed/card.webp`,
        originalStorageKey: `candidates/${suffix}-c/original.png`,
        pdpStorageKey: `candidates/${suffix}-c/processed/pdp.webp`,
        processedStorageKey: `candidates/${suffix}-c/processed/processed.webp`,
        processingStatus: "READY",
        productId: product.id,
        qualityStatus: "APPROVED",
        sourceBytes: 1024,
        sourceHeight: 900,
        sourceMimeType: "image/png",
        sourceWidth: 900
      }
    });

    const approved = await approveProductImageCandidate(product.id, replacement.id);
    const reloadedProduct = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    const previous = await prisma.productImageAsset.findUniqueOrThrow({ where: { id: first.id } });

    assert.equal(approved.id, replacement.id);
    assert.equal(reloadedProduct.activeImageAssetId, replacement.id);
    assert.equal(
      reloadedProduct.imageUrl,
      `/api/storefront/product-images/${replacement.id}/card`
    );
    assert.ok(previous.supersededAt instanceof Date);
  } finally {
    await scope.cleanup();
  }
});
