import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import { createProduct } from "../src/services/productService.js";
import {
  listStorefrontCategories,
  listStorefrontMerchandising,
  listStorefrontProducts
} from "../src/services/storefrontService.js";
import {
  isLikelySameCatalogIdentity,
  normalizeCanonicalProductName,
  normalizeProductIdentity
} from "../src/utils/catalogIdentity.js";
import { captureDatabaseFixtureScope } from "./helpers/databaseFixtureScope.js";

test("canonical size notation normalizes equivalent units without collapsing variants", () => {
  assert.equal(normalizeCanonicalProductName("Coca-Cola 1500 ml"), "Coca-Cola 1.5L");
  assert.equal(
    normalizeProductIdentity("Mineral Water 500mL"),
    normalizeProductIdentity("Mineral Water 500 ml")
  );
  assert.notEqual(
    normalizeProductIdentity("Coca-Cola Original Taste 330ml"),
    normalizeProductIdentity("Coca-Cola Original Taste 1.5L")
  );
  assert.notEqual(
    normalizeProductIdentity("Lucky Me Pancit Canton Original 60g"),
    normalizeProductIdentity("Lucky Me Pancit Canton Chilimansi 60g")
  );
  assert.equal(
    isLikelySameCatalogIdentity(
      { name: "Mineral Water 1500ml" },
      { name: "Mineral Water 1.5L", sizeUnit: "LITER", sizeValue: "1.5" }
    ),
    true
  );
  assert.equal(
    isLikelySameCatalogIdentity(
      { name: "Potato Chips", variant: "Barbecue" },
      { name: "Potato Chips", variant: "Cheese" }
    ),
    false
  );
});

test("manual creation stops a likely duplicate before committing it", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);
  const suffix = randomUUID().slice(0, 8);

  try {
    const category = await prisma.category.create({
      data: {
        dataQualityStatus: "APPROVED",
        isActive: true,
        isStorefrontVisible: true,
        name: `Identity Review ${suffix}`,
        recordSource: "CATALOG",
        slug: `identity-review-${suffix}`
      }
    });
    await createProduct({
      categoryId: category.id,
      costPrice: "10",
      name: `Duplicate Check ${suffix} 1500ml`,
      reorderLevel: 0,
      sellingPrice: "15",
      sku: `IDENTITY-A-${suffix}`,
      targetStockLevel: 0,
      unit: "BOTTLE"
    });

    await assert.rejects(
      () =>
        createProduct({
          categoryId: category.id,
          costPrice: "10",
          name: `Duplicate Check ${suffix} 1.5L`,
          reorderLevel: 0,
          sellingPrice: "15",
          sku: `IDENTITY-B-${suffix}`,
          targetStockLevel: 0,
          unit: "BOTTLE"
        }),
      (error) =>
        error instanceof Error &&
        (error as { code?: string }).code === "PRODUCT_IDENTITY_REVIEW_REQUIRED"
    );
    assert.equal(await prisma.product.count({ where: { sku: `IDENTITY-B-${suffix}` } }), 0);
  } finally {
    await scope.cleanup();
  }
});

test("storefront and merchandising enforce durable catalog quality fields", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);
  const suffix = randomUUID().slice(0, 8);

  try {
    const category = await prisma.category.create({
      data: {
        dataQualityStatus: "APPROVED",
        isActive: true,
        isStorefrontVisible: true,
        name: `Quality Gate ${suffix}`,
        recordSource: "CATALOG",
        slug: `quality-gate-${suffix}`
      }
    });
    const approved = await createSellableProduct({
      categoryId: category.id,
      name: `Approved Product ${suffix}`,
      recordSource: "CATALOG",
      sku: `APPROVED-${suffix}`
    });
    const fixture = await createSellableProduct({
      categoryId: category.id,
      name: `Fixture Product ${suffix}`,
      recordSource: "TEST_FIXTURE",
      sku: `FIXTURE-${suffix}`
    });
    const imageLess = await createSellableProduct({
      categoryId: category.id,
      imageReady: false,
      name: `Image Pending Product ${suffix}`,
      recordSource: "CATALOG",
      sku: `IMAGE-PENDING-${suffix}`
    });
    const unresolvedLeft = await createSellableProduct({
      categoryId: category.id,
      name: `Review Product ${suffix} 500ml`,
      recordSource: "CATALOG",
      sku: `REVIEW-A-${suffix}`
    });
    const unresolvedRight = await createSellableProduct({
      categoryId: category.id,
      name: `Review Product ${suffix} 500 ml`,
      recordSource: "CATALOG",
      sku: `REVIEW-B-${suffix}`
    });
    await prisma.productDuplicateCandidate.create({
      data: {
        confidence: "0.5500",
        evidence: { normalizedName: `review product ${suffix} 500ml` },
        leftProductId: unresolvedLeft.id,
        matchType: "NORMALIZED_IDENTITY",
        reason: "Test unresolved duplicate gate.",
        rightProductId: unresolvedRight.id,
        status: "PENDING"
      }
    });
    await prisma.sale.create({
      data: {
        discountAmount: "0",
        saleNumber: `QUALITY-${suffix}`,
        status: "COMPLETED",
        subtotalAmount: "165",
        totalAmount: "165",
        items: {
          create: [
            {
              productId: approved.id,
              quantity: 1,
              totalAmount: "15",
              unitPrice: "15"
            },
            {
              productId: fixture.id,
              quantity: 10,
              totalAmount: "150",
              unitPrice: "15"
            }
          ]
        }
      }
    });

    const [catalog, categories, merchandising] = await Promise.all([
      listStorefrontProducts({
        availability: "all",
        category: category.slug,
        page: 1,
        pageSize: 24
      }),
      listStorefrontCategories(),
      listStorefrontMerchandising()
    ]);

    assert.ok(catalog.items.some((product) => product.id === approved.id));
    assert.equal(
      catalog.items.some((product) => product.id === fixture.id),
      false
    );
    assert.equal(
      catalog.items.some((product) => product.id === imageLess.id),
      false
    );
    assert.equal(
      catalog.items.some((product) => product.id === unresolvedLeft.id),
      false
    );
    assert.equal(
      catalog.items.some((product) => product.id === unresolvedRight.id),
      false
    );
    const storefrontCategory = categories.find((item) => item.id === category.id);
    assert.equal(storefrontCategory?.productCount, 1);
    assert.deepEqual(storefrontCategory?.representativeProducts, [
      {
        id: approved.id,
        imageUrl: approved.imageUrl,
        name: approved.name
      }
    ]);
    assert.equal(
      merchandising.trending.some((entry) => entry.product.id === fixture.id),
      false
    );
    assert.equal(
      merchandising.bestSellers.some((entry) => entry.product.id === fixture.id),
      false
    );
  } finally {
    await scope.cleanup();
  }
});

async function createSellableProduct(input: {
  categoryId: string;
  imageReady?: boolean;
  name: string;
  recordSource: "CATALOG" | "TEST_FIXTURE";
  sku: string;
}) {
  return prisma.product.create({
    data: {
      categoryId: input.categoryId,
      barcode: `TEST-${input.sku}`,
      costPrice: "10",
      dataQualityStatus: "APPROVED",
      imageUrl:
        input.imageReady === false ? null : `/images/products/${input.sku.toLowerCase()}.webp`,
      inventory: { create: { quantityOnHand: 10 } },
      inventoryBatches: {
        create: {
          batchCode: `BATCH-${input.sku}`,
          quantityReceived: 10,
          quantityRemaining: 10,
          status: "AVAILABLE",
          unitCost: "10"
        }
      },
      isStorefrontVisible: true,
      name: input.name,
      recordSource: input.recordSource,
      sellingPrice: "15",
      sku: input.sku,
      status: "ACTIVE",
      unit: "PIECE"
    }
  });
}
