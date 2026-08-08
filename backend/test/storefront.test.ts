import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { InventoryBatchStatus } from "@prisma/client";

import { prisma } from "../src/database/prismaClient.js";
import {
  createStorefrontOrder,
  listStorefrontProducts
} from "../src/services/storefrontService.js";
import { getSellableStockQuantity } from "../src/services/stockDomainService.js";

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

test("storefront orders remain pending and do not deduct inventory", async () => {
  const suffix = randomUUID().slice(0, 8);
  const category = await prisma.category.create({
    data: {
      name: `Storefront Test ${suffix}`,
      slug: `storefront-test-${suffix}`,
      isActive: true
    }
  });
  const product = await prisma.product.create({
    data: {
      categoryId: category.id,
      sku: `STOREFRONT-${suffix}`,
      name: `Storefront Test Product ${suffix}`,
      unit: "PIECE",
      costPrice: "10.00",
      sellingPrice: "15.00",
      reorderLevel: 2,
      targetStockLevel: 8,
      status: "ACTIVE",
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

  try {
    const catalog = await listStorefrontProducts({
      availability: "all",
      category: category.slug,
      page: 1,
      pageSize: 24
    });
    const storefrontProduct = catalog.items.find((item) => item.id === product.id);

    assert.equal(storefrontProduct?.availableStock, 5);
    assert.equal("costPrice" in (storefrontProduct ?? {}), false);
    assert.equal("reorderLevel" in (storefrontProduct ?? {}), false);

    const salesBefore = await prisma.sale.count();
    const order = await createStorefrontOrder({
      customerName: "Storefront Test Customer",
      customerEmail: "customer@example.com",
      customerPhone: "09171234567",
      fulfillmentMethod: "STORE_PICKUP",
      paymentMethod: "CASH_ON_PICKUP",
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
    await prisma.customerOrder.deleteMany({
      where: { items: { some: { productId: product.id } } }
    });
    await prisma.inventoryBatch.deleteMany({ where: { productId: product.id } });
    await prisma.inventory.deleteMany({ where: { productId: product.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.category.delete({ where: { id: category.id } });
  }
});
