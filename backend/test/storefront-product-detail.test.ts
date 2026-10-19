import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import {
  getStorefrontProduct,
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
    assert.equal(allReviews.reviews[0]?.verifiedPurchase, false);

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

test("product detail shows only sellable size siblings in ascending package order", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);
  const suffix = randomUUID().slice(0, 8);

  try {
    const { category } = await ensureCanonicalStorefrontCategory(0);
    const small = await createProduct(
      category.id,
      `Variant Water ${suffix} 330ml`,
      `${suffix}-330`,
      5
    );
    const current = await createProduct(
      category.id,
      `Variant Water ${suffix} 500ml`,
      `${suffix}-500`,
      4
    );
    const large = await createProduct(
      category.id,
      `Variant Water ${suffix} 1L`,
      `${suffix}-1000`,
      3
    );
    const unavailable = await createProduct(
      category.id,
      `Variant Water ${suffix} 1.5L`,
      `${suffix}-1500`,
      0
    );
    const otherVariant = await createProduct(
      category.id,
      `Variant Water Zero ${suffix} 500ml`,
      `${suffix}-zero`,
      6
    );

    const detail = await getStorefrontProduct(current.id);

    assert.deepEqual(
      detail.sizeVariants.map((variant) => ({
        id: variant.id,
        sizeTier: variant.sizeTier,
        sizeUnit: variant.sizeUnit,
        sizeValue: variant.sizeValue,
        stockStatus: variant.stockStatus
      })),
      [
        {
          id: small.id,
          sizeTier: "SMALL",
          sizeUnit: "MILLILITER",
          sizeValue: "330",
          stockStatus: "IN_STOCK"
        },
        {
          id: current.id,
          sizeTier: "MEDIUM",
          sizeUnit: "MILLILITER",
          sizeValue: "500",
          stockStatus: "IN_STOCK"
        },
        {
          id: large.id,
          sizeTier: "LARGE",
          sizeUnit: "LITER",
          sizeValue: "1",
          stockStatus: "IN_STOCK"
        }
      ]
    );
    assert.equal(
      detail.sizeVariants.some((variant) => variant.id === unavailable.id),
      false
    );
    assert.equal(
      detail.sizeVariants.some((variant) => variant.id === otherVariant.id),
      false
    );
  } finally {
    await scope.cleanup();
  }
});

test("sold-out stock is hidden from customer search and direct links until restocked", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);
  const suffix = randomUUID().slice(0, 8);
  try {
    const { category } = await ensureCanonicalStorefrontCategory(0);
    const soldOut = await createProduct(
      category.id,
      `Sold-out Product ${suffix}`,
      `${suffix}-sold`,
      0
    );
    const inStock = await createProduct(
      category.id,
      `Available Product ${suffix}`,
      `${suffix}-ready`,
      3
    );
    const list = async (availability: "all" | "in-stock" | "out-of-stock") =>
      listStorefrontProducts({
        availability,
        category: category.slug,
        page: 1,
        pageSize: 24,
        search: suffix
      });
    const before = await list("all");
    assert.deepEqual(before.items.map((product) => product.id), [inStock.id]);
    assert.equal(before.meta.totalItems, 1);
    assert.deepEqual((await list("in-stock")).items.map((product) => product.id), [inStock.id]);
    assert.deepEqual((await list("out-of-stock")).items, []);
    await assert.rejects(getStorefrontProduct(soldOut.id), (error: unknown) => {
      assert.equal((error as { statusCode?: number }).statusCode, 404);
      return true;
    });
    const related = await listStorefrontRelatedProducts(inStock.id, 4);
    assert.equal(related.sameCategory.some((item) => item.id === soldOut.id), false);

    // Stock-in makes the existing active product visible again without toggling status.
    await prisma.inventoryBatch.create({
      data: {
        batchCode: `RESTOCK-${suffix}`,
        productId: soldOut.id,
        quantityReceived: 2,
        quantityRemaining: 2,
        unitCost: "10.00",
        status: "AVAILABLE"
      }
    });
    await prisma.inventory.update({
      where: { productId: soldOut.id },
      data: { quantityOnHand: 2 }
    });
    const after = await list("all");
    assert.deepEqual(
      new Set(after.items.map((product) => product.id)),
      new Set([soldOut.id, inStock.id])
    );
    assert.equal((await getStorefrontProduct(soldOut.id)).availableStock, 2);
  } finally {
    await scope.cleanup();
  }
});

test("verified Gardenia family links 400g/600g but excludes unrelated bread", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);
  const suffix = randomUUID().slice(0, 8);

  try {
    const { category } = await ensureCanonicalStorefrontCategory(0);
    const classic = await createProduct(
      category.id,
      "Gardenia Classic Enriched White Bread 400g",
      `${suffix}-gardenia-400`,
      5
    );
    const enriched = await createProduct(
      category.id,
      "Gardenia Enriched White Bread 600g",
      `${suffix}-gardenia-600`,
      4
    );
    const unrelated = await createProduct(
      category.id,
      "Gardenia High Fiber Whole Wheat Bread 600g",
      `${suffix}-wholewheat`,
      3
    );

    await prisma.product.update({
      where: { id: classic.id },
      data: {
        brand: "Gardenia",
        variant: "Classic Enriched White",
        sizeUnit: "GRAM",
        sizeValue: "400",
        unit: "PACK"
      }
    });
    await prisma.product.update({
      where: { id: enriched.id },
      data: {
        brand: "Gardenia",
        variant: "Enriched White",
        sizeUnit: "GRAM",
        sizeValue: "600",
        unit: "PACK"
      }
    });
    await prisma.product.update({
      where: { id: unrelated.id },
      data: {
        brand: "Gardenia",
        variant: "Enriched White",
        sizeUnit: "GRAM",
        sizeValue: "600",
        unit: "PACK"
      }
    });

    const detail = await getStorefrontProduct(classic.id);
    assert.deepEqual(
      detail.sizeVariants.map((variant) => variant.id),
      [classic.id, enriched.id]
    );
    assert.equal(
      detail.sizeVariants.some((variant) => variant.id === unrelated.id),
      false
    );
  } finally {
    await scope.cleanup();
  }
});

test("related products stay strictly inside the current category", async () => {
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
    const returnedIds = result.sameCategory.map((product) => product.id);

    assert.equal(returnedIds.includes(current.id), false);
    assert.equal(new Set(returnedIds).size, returnedIds.length);
    assert.equal(
      result.sameCategory.every((product) => product.category.id === category.id),
      true
    );
    assert.deepEqual(result.fallback, []);
    assert.ok(returnedIds.length <= 4);

    if (categoryFixture.created && fallbackCategoryFixture.created) {
      assert.deepEqual(
        result.sameCategory.map((product) => product.id),
        [sameAvailable.id]
      );
      assert.ok(result.sameCategory.every((item) => item.availableStock > 0));
      assert.equal(result.sameCategory[0]?.averageRating, 4.5);
      assert.equal(result.sameCategory[0]?.reviewCount, 2);
      assert.equal(returnedIds.includes(sameUnavailable.id), false);
      assert.equal(returnedIds.includes(fallbackAvailable.id), false);
      assert.deepEqual(result.fallback, []);
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
