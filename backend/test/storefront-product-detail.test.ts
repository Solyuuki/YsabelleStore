import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import {
  listStorefrontProducts,
  listStorefrontProductReviews,
  listStorefrontRelatedProducts
} from "../src/services/storefrontService.js";
import { storefrontProductReviewQuerySchema } from "../src/validators/storefront.validators.js";
import { captureDatabaseFixtureScope } from "./helpers/databaseFixtureScope.js";
import { ensureCanonicalStorefrontCategory } from "./helpers/storefrontCanonicalCategory.js";

test("storefront listings expose persisted rating aggregates and explicit zero-review values", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);
  const suffix = randomUUID().slice(0, 8);

  try {
    const { category } = await ensureCanonicalStorefrontCategory(0);
    const reviewed = await createProduct(
      category.id,
      `Reviewed Listing ${suffix}`,
      `${suffix}-rated`,
      4
    );
    const unrated = await createProduct(
      category.id,
      `Unrated Listing ${suffix}`,
      `${suffix}-unrated`,
      3
    );

    await prisma.productReview.createMany({
      data: [
        {
          comment: "Excellent.",
          productId: reviewed.id,
          rating: 5,
          reviewerDisplayName: "Customer A"
        },
        {
          comment: "Very good.",
          productId: reviewed.id,
          rating: 4,
          reviewerDisplayName: "Customer B"
        },
        {
          comment: "Would buy again.",
          productId: reviewed.id,
          rating: 5,
          reviewerDisplayName: "Customer C"
        }
      ]
    });

    const result = await listStorefrontProducts({
      availability: "all",
      category: category.slug,
      page: 1,
      pageSize: 24,
      search: suffix
    });
    const products = new Map(result.items.map((product) => [product.id, product]));

    assert.deepEqual(
      {
        averageRating: products.get(reviewed.id)?.averageRating,
        reviewCount: products.get(reviewed.id)?.reviewCount
      },
      { averageRating: 4.7, reviewCount: 3 }
    );
    assert.deepEqual(
      {
        averageRating: products.get(unrated.id)?.averageRating,
        reviewCount: products.get(unrated.id)?.reviewCount
      },
      { averageRating: 0, reviewCount: 0 }
    );
  } finally {
    await scope.cleanup();
  }
});

test("storefront reviews aggregate persisted ratings and support bounded rating filters", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);
  const suffix = randomUUID().slice(0, 8);

  try {
    const { category } = await ensureCanonicalStorefrontCategory(0);
    const product = await createProduct(category.id, `Reviewed Product ${suffix}`, suffix, 4);

    const empty = await listStorefrontProductReviews(product.id, { page: 1, pageSize: 10 });
    assert.equal(empty.summary.averageRating, null);
    assert.equal(empty.summary.totalReviews, 0);
    assert.deepEqual(
      empty.summary.distribution.map(({ count, rating }) => ({ count, rating })),
      [
        { count: 0, rating: 5 },
        { count: 0, rating: 4 },
        { count: 0, rating: 3 },
        { count: 0, rating: 2 },
        { count: 0, rating: 1 }
      ]
    );
    assert.deepEqual(empty.reviews, []);

    await prisma.productReview.createMany({
      data: [
        {
          comment: "Fresh and well packed.",
          productId: product.id,
          rating: 5,
          reviewerDisplayName: "Customer A"
        },
        {
          comment: "Good value for the price.",
          productId: product.id,
          rating: 4,
          reviewerDisplayName: "Customer B"
        },
        {
          comment: "Would buy again.",
          productId: product.id,
          rating: 5,
          reviewerDisplayName: "Customer C"
        }
      ]
    });

    const allReviews = await listStorefrontProductReviews(product.id, { page: 1, pageSize: 10 });
    const fiveStar = allReviews.summary.distribution.find((entry) => entry.rating === 5);
    assert.equal(allReviews.summary.averageRating, 4.7);
    assert.equal(allReviews.summary.totalReviews, 3);
    assert.equal(fiveStar?.count, 2);
    assert.equal(fiveStar?.percentage, 67);
    assert.equal(allReviews.reviews.length, 3);
    assert.equal("verifiedPurchase" in (allReviews.reviews[0] ?? {}), false);

    const filtered = await listStorefrontProductReviews(product.id, {
      page: 1,
      pageSize: 10,
      rating: 4
    });
    assert.equal(filtered.reviews.length, 1);
    assert.equal(filtered.reviews[0]?.rating, 4);
    assert.equal(filtered.meta.totalItems, 1);

    for (const rating of [1, 2, 3, 4, 5]) {
      assert.equal(storefrontProductReviewQuerySchema.safeParse({ rating }).success, true);
    }
    assert.equal(storefrontProductReviewQuerySchema.safeParse({ rating: 0 }).success, false);
    assert.equal(storefrontProductReviewQuerySchema.safeParse({ rating: 6 }).success, false);
  } finally {
    await scope.cleanup();
  }
});

test("related products exclude the current item and keep fallback products separately labeled", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);
  const suffix = randomUUID().slice(0, 8);

  try {
    const categoryFixture = await ensureCanonicalStorefrontCategory(0);
    const fallbackCategoryFixture = await ensureCanonicalStorefrontCategory(1);
    const category = categoryFixture.category;
    const fallbackCategory = fallbackCategoryFixture.category;
    const current = await createProduct(category.id, `Current ${suffix}`, `${suffix}-current`, 2);
    const sameAvailable = await createProduct(
      category.id,
      `Available Same Category ${suffix}`,
      `${suffix}-same-available`,
      6
    );
    const sameUnavailable = await createProduct(
      category.id,
      `Unavailable Same Category ${suffix}`,
      `${suffix}-same-unavailable`,
      0
    );
    const fallbackAvailable = await createProduct(
      fallbackCategory.id,
      `Available Fallback ${suffix}`,
      `${suffix}-fallback`,
      5
    );

    await prisma.productReview.createMany({
      data: [
        {
          comment: "A strong option.",
          productId: sameAvailable.id,
          rating: 5,
          reviewerDisplayName: "Customer A"
        },
        {
          comment: "Good overall.",
          productId: sameAvailable.id,
          rating: 4,
          reviewerDisplayName: "Customer B"
        }
      ]
    });

    const result = await listStorefrontRelatedProducts(current.id, 4);
    const returned = [...result.sameCategory, ...result.fallback];
    const returnedIds = returned.map((product) => product.id);

    assert.equal(returnedIds.includes(current.id), false);
    assert.equal(new Set(returnedIds).size, returnedIds.length);
    assert.equal(
      result.sameCategory.every((product) => product.category.id === category.id),
      true
    );
    assert.equal(
      result.fallback.every((product) => product.category.id !== category.id),
      true
    );
    assert.ok(returnedIds.length <= 4);

    if (categoryFixture.created && fallbackCategoryFixture.created) {
      assert.deepEqual(
        result.sameCategory.map((product) => product.id),
        [sameAvailable.id, sameUnavailable.id]
      );
      assert.ok((result.sameCategory[0]?.availableStock ?? 0) > 0);
      assert.equal(result.sameCategory[1]?.availableStock, 0);
      assert.equal(result.sameCategory[0]?.averageRating, 4.5);
      assert.equal(result.sameCategory[0]?.reviewCount, 2);
      assert.equal(result.sameCategory[1]?.averageRating, 0);
      assert.equal(result.sameCategory[1]?.reviewCount, 0);
      assert.equal(
        result.fallback.some((product) => product.id === fallbackAvailable.id),
        true
      );
      assert.ok((result.fallback[0]?.availableStock ?? 0) > 0);
    }
  } finally {
    await scope.cleanup();
  }
});

async function createProduct(categoryId: string, name: string, token: string, stock: number) {
  return prisma.product.create({
    data: {
      barcode: `DETAIL-BARCODE-${token}`,
      categoryId,
      costPrice: "10.00",
      dataQualityStatus: "APPROVED",
      imageUrl: `/images/products/${token}.webp`,
      inventory: { create: { quantityOnHand: stock } },
      inventoryBatches:
        stock > 0
          ? {
              create: {
                batchCode: `DETAIL-${token}`,
                quantityReceived: stock,
                quantityRemaining: stock,
                status: "AVAILABLE",
                unitCost: "10.00"
              }
            }
          : undefined,
      isStorefrontVisible: true,
      name,
      recordSource: "CATALOG",
      reorderLevel: 1,
      sellingPrice: "15.00",
      sku: `DETAIL-${token}`,
      status: "ACTIVE",
      targetStockLevel: 8,
      unit: "PIECE"
    }
  });
}
