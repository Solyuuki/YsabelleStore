import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import { registerCustomer } from "../src/services/customerAuthService.js";
import {
  addCustomerFavorite,
  getCustomerReviewContext,
  listCustomerFavoriteProducts,
  listStorefrontProductReviews,
  removeCustomerFavorite,
  upsertCustomerProductReview
} from "../src/services/storefrontService.js";
import {
  updateCustomerModerationStatus,
  updateProductReviewModerationStatus
} from "../src/services/customerModerationService.js";
import { captureDatabaseFixtureScope } from "./helpers/databaseFixtureScope.js";
import { ensureCanonicalStorefrontCategory } from "./helpers/storefrontCanonicalCategory.js";

const PASSWORD = "CustomerPass123!";

test("favorites persist per customer and verified reviews require a completed purchase", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);
  const suffix = randomUUID().slice(0, 8);

  try {
    const { category } = await ensureCanonicalStorefrontCategory(0);
    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        barcode: `TEST-ENGAGEMENT-${suffix}`,
        sku: `ENGAGEMENT-${suffix}`,
        name: `Engagement Product ${suffix}`,
        imageUrl: `/images/products/engagement-${suffix}.webp`,
        unit: "PIECE",
        costPrice: "10.00",
        sellingPrice: "20.00",
        reorderLevel: 2,
        targetStockLevel: 12,
        status: "ACTIVE",
        recordSource: "CATALOG",
        dataQualityStatus: "APPROVED",
        isStorefrontVisible: true,
        inventory: { create: { quantityOnHand: 10 } },
        inventoryBatches: {
          create: {
            batchCode: `ENGAGEMENT-BATCH-${suffix}`,
            quantityReceived: 10,
            quantityRemaining: 10,
            unitCost: "10.00",
            status: "AVAILABLE"
          }
        }
      }
    });
    const registered = await registerCustomer({
      name: "Verified Reviewer",
      username: `verified.reviewer.${suffix}`,
      email: `verified-reviewer-${suffix}@example.com`,
      phone: `0918${Number.parseInt(suffix, 16).toString().slice(-7).padStart(7, "0")}`,
      password: PASSWORD
    });

    await addCustomerFavorite(registered.customer.id, product.id);
    const favorites = await listCustomerFavoriteProducts(registered.customer.id);
    assert.equal(favorites.some((favorite) => favorite.id === product.id), true);

    await removeCustomerFavorite(registered.customer.id, product.id);
    assert.equal((await listCustomerFavoriteProducts(registered.customer.id)).length, 0);

    const beforePurchase = await getCustomerReviewContext(registered.customer.id, product.id);
    assert.equal(beforePurchase.eligible, false);

    await assert.rejects(
      () =>
        upsertCustomerProductReview(registered.customer.id, product.id, {
          rating: 5,
          comment: "Excellent pantry staple."
        }),
      /completed purchase is required/i
    );

    const order = await prisma.customerOrder.create({
      data: {
        customerAccountId: registered.customer.id,
        orderNumber: `YS-REVIEW-${suffix.toUpperCase()}`,
        customerName: registered.customer.name,
        customerEmail: registered.customer.email,
        customerPhone: registered.customer.phone ?? "09181234567",
        fulfillmentMethod: "STORE_PICKUP",
        paymentMethod: "CASH_ON_PICKUP",
        status: "COMPLETED",
        subtotalAmount: "20.00",
        totalAmount: "20.00",
        items: {
          create: {
            productId: product.id,
            quantity: 1,
            unitPrice: "20.00",
            totalAmount: "20.00"
          }
        }
      }
    });

    const context = await getCustomerReviewContext(registered.customer.id, product.id);
    assert.equal(context.eligible, true);
    assert.equal(context.verifiedOrder?.id, order.id);

    const created = await upsertCustomerProductReview(registered.customer.id, product.id, {
      rating: 5,
      comment: "Excellent pantry staple."
    });
    assert.equal(created.verifiedPurchase, true);

    const publicReviews = await listStorefrontProductReviews(product.id, {
      page: 1,
      pageSize: 10
    });
    assert.equal(publicReviews.summary.totalReviews, 1);
    assert.equal(publicReviews.reviews[0]?.verifiedPurchase, true);
    assert.equal(publicReviews.reviews[0]?.comment, "Excellent pantry staple.");

    const updated = await upsertCustomerProductReview(registered.customer.id, product.id, {
      rating: 4,
      comment: "Still very good after another try."
    });
    assert.equal(updated.id, created.id);
    assert.equal(
      await prisma.productReview.count({
        where: { customerAccountId: registered.customer.id, productId: product.id }
      }),
      1
    );
  } finally {
    await scope.cleanup();
  }
});

test("owner moderation hides reviews and restricted customers lose active sessions", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);
  const suffix = randomUUID().slice(0, 8);

  try {
    const { category } = await ensureCanonicalStorefrontCategory(0);
    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        barcode: `TEST-MODERATION-${suffix}`,
        sku: `MODERATION-${suffix}`,
        name: `Moderation Product ${suffix}`,
        imageUrl: `/images/products/moderation-${suffix}.webp`,
        unit: "PIECE",
        costPrice: "8.00",
        sellingPrice: "16.00",
        reorderLevel: 1,
        targetStockLevel: 8,
        status: "ACTIVE",
        recordSource: "CATALOG",
        dataQualityStatus: "APPROVED",
        isStorefrontVisible: true,
        inventory: { create: { quantityOnHand: 8 } },
        inventoryBatches: {
          create: {
            batchCode: `MODERATION-BATCH-${suffix}`,
            quantityReceived: 8,
            quantityRemaining: 8,
            unitCost: "8.00",
            status: "AVAILABLE"
          }
        }
      }
    });
    const registered = await registerCustomer({
      name: "Moderated Customer",
      username: `moderated.customer.${suffix}`,
      email: `moderated-customer-${suffix}@example.com`,
      phone: `0919${Number.parseInt(suffix, 16).toString().slice(-7).padStart(7, "0")}`,
      password: PASSWORD
    });
    const owner = await prisma.user.create({
      data: {
        name: "Moderation Owner",
        email: `moderation-owner-${suffix}@example.com`,
        passwordHash: "test-only-password-hash",
        role: "OWNER",
        status: "ACTIVE"
      }
    });
    await prisma.customerOrder.create({
      data: {
        customerAccountId: registered.customer.id,
        orderNumber: `YS-MOD-${suffix.toUpperCase()}`,
        customerName: registered.customer.name,
        customerEmail: registered.customer.email,
        customerPhone: registered.customer.phone ?? "09191234567",
        fulfillmentMethod: "STORE_PICKUP",
        paymentMethod: "CASH_ON_PICKUP",
        status: "COMPLETED",
        subtotalAmount: "16.00",
        totalAmount: "16.00",
        items: {
          create: {
            productId: product.id,
            quantity: 1,
            unitPrice: "16.00",
            totalAmount: "16.00"
          }
        }
      }
    });
    const review = await upsertCustomerProductReview(registered.customer.id, product.id, {
      rating: 5,
      comment: "Verified customer feedback."
    });

    await updateProductReviewModerationStatus(
      review.id,
      { status: "HIDDEN", reason: "Moderation fixture hides this review." },
      owner.id
    );

    const hiddenPublic = await listStorefrontProductReviews(product.id, {
      page: 1,
      pageSize: 10
    });
    assert.equal(hiddenPublic.summary.totalReviews, 0);
    assert.equal(hiddenPublic.reviews.length, 0);

    await updateCustomerModerationStatus(
      registered.customer.id,
      { status: "SUSPENDED", reason: "Moderation fixture suspension." },
      owner.id
    );

    const [customer, activeSessions, audits] = await Promise.all([
      prisma.customerAccount.findUniqueOrThrow({ where: { id: registered.customer.id } }),
      prisma.customerSession.count({
        where: { customerAccountId: registered.customer.id, revokedAt: null }
      }),
      prisma.customerModerationAudit.findMany({
        where: { customerAccountId: registered.customer.id }
      })
    ]);
    assert.equal(customer.status, "SUSPENDED");
    assert.equal(activeSessions, 0);
    assert.ok(audits.length >= 2);

    await assert.rejects(
      () =>
        upsertCustomerProductReview(registered.customer.id, product.id, {
          rating: 5,
          comment: "A suspended account cannot publish."
        }),
      /cannot publish reviews/i
    );
  } finally {
    await scope.cleanup();
  }
});
