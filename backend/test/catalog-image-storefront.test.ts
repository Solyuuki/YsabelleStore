import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import { listStorefrontProducts } from "../src/services/storefrontService.js";
import { captureDatabaseFixtureScope } from "./helpers/databaseFixtureScope.js";

test("storefront accepts an active approved CIQE image and keeps list payload card-only", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);
  const suffix = randomUUID().slice(0, 8);

  try {
    const category = await prisma.category.create({
      data: {
        dataQualityStatus: "APPROVED",
        isActive: true,
        isStorefrontVisible: true,
        name: `CIQE Storefront ${suffix}`,
        recordSource: "CATALOG",
        slug: `ciqe-storefront-${suffix}`
      }
    });
    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        costPrice: "10",
        dataQualityStatus: "APPROVED",
        isStorefrontVisible: true,
        name: `CIQE Product ${suffix}`,
        sellingPrice: "15",
        sku: `CIQE-STOREFRONT-${suffix}`,
        status: "ACTIVE",
        unit: "PIECE"
      }
    });
    const asset = await prisma.productImageAsset.create({
      data: {
        approvedAt: new Date(),
        cardStorageKey: `candidates/${suffix}/processed/card.webp`,
        originalStorageKey: `candidates/${suffix}/original.png`,
        pdpStorageKey: `candidates/${suffix}/processed/pdp.webp`,
        processedStorageKey: `candidates/${suffix}/processed/processed.webp`,
        processingStatus: "READY",
        productId: product.id,
        qualityStatus: "APPROVED",
        sourceBytes: 1024,
        sourceHeight: 900,
        sourceMimeType: "image/png",
        sourceWidth: 900
      }
    });
    await prisma.product.update({
      data: {
        activeImageAssetId: asset.id,
        imageUrl: `/api/storefront/product-images/${asset.id}/card`
      },
      where: { id: product.id }
    });

    const catalog = await listStorefrontProducts({
      availability: "all",
      category: category.slug,
      page: 1,
      pageSize: 24
    });
    const storefrontProduct = catalog.items.find((item) => item.id === product.id);

    assert.ok(storefrontProduct);
    assert.equal(storefrontProduct.imageUrl, `/api/storefront/product-images/${asset.id}/card`);
    assert.equal("detailImageUrl" in storefrontProduct, false);
  } finally {
    await scope.cleanup();
  }
});

test("storefront still accepts legacy curated product images without an active CIQE asset", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);
  const suffix = randomUUID().slice(0, 8);

  try {
    const category = await prisma.category.create({
      data: {
        dataQualityStatus: "APPROVED",
        isActive: true,
        isStorefrontVisible: true,
        name: `Legacy Storefront ${suffix}`,
        recordSource: "CATALOG",
        slug: `legacy-storefront-${suffix}`
      }
    });
    const imageUrl = `/images/products/legacy-${suffix}.webp`;
    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        costPrice: "10",
        dataQualityStatus: "APPROVED",
        imageUrl,
        isStorefrontVisible: true,
        name: `Legacy Product ${suffix}`,
        sellingPrice: "15",
        sku: `LEGACY-STOREFRONT-${suffix}`,
        status: "ACTIVE",
        unit: "PIECE"
      }
    });

    const catalog = await listStorefrontProducts({
      availability: "all",
      category: category.slug,
      page: 1,
      pageSize: 24
    });
    const storefrontProduct = catalog.items.find((item) => item.id === product.id);

    assert.ok(storefrontProduct);
    assert.equal(storefrontProduct.imageUrl, imageUrl);
    assert.equal("detailImageUrl" in storefrontProduct, false);
  } finally {
    await scope.cleanup();
  }
});
