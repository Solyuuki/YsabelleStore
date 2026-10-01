import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { InventoryBatchStatus } from "@prisma/client";

import { prisma } from "../src/database/prismaClient.js";
import {
  createStorefrontOrder,
  listStorefrontCategories,
  listStorefrontMerchandising,
  listStorefrontProducts
} from "../src/services/storefrontService.js";
import { getSellableStockQuantity } from "../src/services/stockDomainService.js";
import { storefrontOrderSchema } from "../src/validators/storefront.validators.js";
import { captureDatabaseFixtureScope } from "./helpers/databaseFixtureScope.js";
import { ensureCanonicalStorefrontCategory } from "./helpers/storefrontCanonicalCategory.js";

test("sellable stock excludes expired and unavailable batches", () => {
  const quantity = getSellableStockQuantity([
    {
      expiresAt: null,
      quantityRemaining: 4,
      status: InventoryBatchStatus.AVAILABLE
    },
    {
      expiresAt: new Date(Date.now() - 86_400_000),
      quantityRemaining: 6,
      status: InventoryBatchStatus.AVAILABLE
    },
    {
      expiresAt: null,
      quantityRemaining: 3,
      status: InventoryBatchStatus.REMOVED
    }
  ]);

  assert.equal(quantity, 4);
});

test("storefront merchandising keeps review-led trending separate from sales-backed best sellers", async () => {
  const merchandising = await listStorefrontMerchandising();

  assert.equal(merchandising.trendingWindowDays, 30);
  assert.ok(merchandising.trending.length <= 4);
  merchandising.trending.forEach((entry, index) => {
    assert.equal(entry.rank, index + 1);
    assert.ok(entry.trendingScore > 0);
    assert.ok(entry.recentReviewCount > 0);
    assert.ok(entry.product.averageRating >= 4);
    assert.ok(entry.product.availableStock > 0);
    if (index > 0) {
      assert.ok((merchandising.trending[index - 1]?.trendingScore ?? 0) >= entry.trendingScore);
    }
  });

  assert.ok(merchandising.bestSellers.length <= 4);
  merchandising.bestSellers.forEach((entry, index) => {
    assert.equal(entry.rank, index + 1);
    assert.ok(entry.unitsSold > 0);
    assert.ok(entry.product.availableStock > 0);
    if (index > 0) {
      assert.ok((merchandising.bestSellers[index - 1]?.unitsSold ?? 0) >= entry.unitsSold);
    }
  });
});

test("storefront orders remain pending and do not deduct inventory", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);
  const suffix = randomUUID().slice(0, 8);

  try {
    const categoryFixture = await ensureCanonicalStorefrontCategory(0);
    const category = categoryFixture.category;
    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        barcode: `TEST-STOREFRONT-${suffix}`,
        sku: `STOREFRONT-${suffix}`,
        name: `Storefront Test Product ${suffix}`,
        imageUrl: `/images/products/storefront-test-${suffix}.webp`,
        unit: "PIECE",
        costPrice: "10.00",
        sellingPrice: "15.00",
        reorderLevel: 2,
        targetStockLevel: 8,
        status: "ACTIVE",
        recordSource: "CATALOG",
        dataQualityStatus: "APPROVED",
        isStorefrontVisible: true,
        inventory: { create: { quantityOnHand: 5 } },
        inventoryBatches: {
          create: {
            batchCode: `STOREFRONT-BATCH-${suffix}`,
            quantityReceived: 5,
            quantityRemaining: 5,
            unitCost: "10.00",
            status: "AVAILABLE"
          }
        }
      }
    });

    const catalog = await listStorefrontProducts({
      availability: "all",
      category: category.slug,
      page: 1,
      pageSize: 24,
      search: suffix
    });
    const storefrontProduct = catalog.items.find((item) => item.id === product.id);
    const storefrontCategories = await listStorefrontCategories();
    const storefrontCategory = storefrontCategories.find((item) => item.id === category.id);

    assert.equal(storefrontProduct?.availableStock, 5);
    assert.equal(storefrontProduct?.imageUrl, `/images/products/storefront-test-${suffix}.webp`);
    assert.ok(storefrontCategory);

    assert.equal("representativeProducts" in storefrontCategory, false);
    if (storefrontCategory.storefrontCover) {
      assert.match(
        storefrontCategory.storefrontCover.imageUrl,
        /^\/api\/storefront\/category-images\/[^/]+\/cover$/
      );
      assert.ok(["LEFT", "CENTER", "RIGHT"].includes(storefrontCategory.storefrontCover.position));
    }

    assert.equal("costPrice" in (storefrontProduct ?? {}), false);
    assert.equal("reorderLevel" in (storefrontProduct ?? {}), false);

    const salesBefore = await prisma.sale.count();
    const order = await createStorefrontOrder({
      customerName: "Storefront Test Customer",
      customerEmail: "customer@example.com",
      customerPhone: "09171234567",
      customerAddress: {
        addressLine1: "110 A. Mabini Street",
        addressLine2: "",
        barangay: "Kapitolyo",
        cityMunicipality: "Pasig City",
        provinceRegion: "Metro Manila",
        postalCode: "1603",
        country: "Philippines"
      },
      fulfillmentMethod: "DELIVERY",
      paymentMethod: "CASH_ON_DELIVERY",
      items: [{ productId: product.id, quantity: 2 }]
    });
    const [inventory, batch, salesAfter] = await Promise.all([
      prisma.inventory.findUniqueOrThrow({ where: { productId: product.id } }),
      prisma.inventoryBatch.findFirstOrThrow({ where: { productId: product.id } }),
      prisma.sale.count()
    ]);

    assert.equal(order.status, "PENDING");
    assert.equal(order.totalAmount, "30");
    assert.equal(inventory.quantityOnHand, 5);
    assert.equal(batch.quantityRemaining, 5);
    assert.equal(salesAfter, salesBefore);
  } finally {
    await scope.cleanup();
  }
});

test("storefront category serializer exposes only dedicated category cover media", async () => {
  const serviceSource = readFileSync(
    resolve(process.cwd(), "src/services/storefrontService.ts"),
    "utf8"
  );

  assert.match(serviceSource, /storefrontCover:/);
  assert.match(serviceSource, /approvedCategoryCoverUrl\(activeCoverAssetId, "cover"\)/);
  assert.doesNotMatch(serviceSource, /representativeProducts/);
  assert.doesNotMatch(serviceSource, /select: \{ id: true, imageUrl: true, name: true \}/);
});


test("PayMongo delivery checkout payload accepts saved customer defaults", () => {
  const parsed = storefrontOrderSchema.safeParse({
    customerName: "ALTHEA PERONA",
    customerEmail: "perona_althea@plpasig.edu.ph",
    customerPhone: "09766500867",
    customerAddress: {
      addressLine1: "217 C Dr. Pilapil St.",
      addressLine2: "",
      barangay: "San Miguel",
      cityMunicipality: "Pasig",
      provinceRegion: "Metro Manila",
      postalCode: "1600",
      country: "Philippines"
    },
    saveAddressToAccount: false,
    saveContactPhoneToAccount: false,
    notes: "",
    fulfillmentMethod: "DELIVERY",
    paymentMethod: "PAYMONGO",
    items: [
      { productId: "product-1", quantity: 2 },
      { productId: "product-2", quantity: 1 }
    ]
  });

  assert.equal(parsed.success, true);
});
