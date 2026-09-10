import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import { Prisma } from "@prisma/client";

import { prisma } from "../src/database/prismaClient.js";
import { getDashboardSummary } from "../src/services/dashboardService.js";
import { ensureCatalogInventoryShells } from "../src/services/inventoryBootstrapService.js";
import { addStock } from "../src/services/inventoryService.js";
import { createCategory, createProduct } from "../src/services/productService.js";
import {
  captureDatabaseFixtureScope,
  type DatabaseFixtureScope
} from "./helpers/databaseFixtureScope.js";

let fixtureScope: DatabaseFixtureScope;

test.before(async () => {
  fixtureScope = await captureDatabaseFixtureScope(prisma);
});

test.after(async () => {
  await fixtureScope.cleanup();
  await prisma.$disconnect();
});

test(
  "inventory bootstrap creates a zero-stock shell without fabricating batches or movements",
  { concurrency: false },
  async () => {
    const category = await createCategory({ name: uniqueLabel("Bootstrap Category") });
    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        costPrice: null,
        dataQualityStatus: "APPROVED",
        isStorefrontVisible: false,
        name: uniqueLabel("Bootstrap Product"),
        recordSource: "IMPORT",
        sellingPrice: new Prisma.Decimal("25.00"),
        sku: uniqueSku("BOOT"),
        status: "ACTIVE"
      }
    });

    assert.equal(await prisma.inventory.findUnique({ where: { productId: product.id } }), null);

    const result = await ensureCatalogInventoryShells({ productIds: [product.id] });
    const inventory = await prisma.inventory.findUnique({ where: { productId: product.id } });
    const [batchCount, movementCount] = await Promise.all([
      prisma.inventoryBatch.count({ where: { productId: product.id } }),
      prisma.inventoryMovement.count({ where: { productId: product.id } })
    ]);

    assert.equal(result.candidates, 1);
    assert.equal(result.created, 1);
    assert.ok(inventory);
    assert.equal(inventory?.quantityOnHand, 0);
    assert.equal(inventory?.version, 0);
    assert.equal(batchCount, 0);
    assert.equal(movementCount, 0);
  }
);

test(
  "inventory bootstrap refuses to hide existing batch evidence behind a zero aggregate",
  { concurrency: false },
  async () => {
    const category = await createCategory({ name: uniqueLabel("Unsafe Bootstrap Category") });
    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        costPrice: new Prisma.Decimal("8.00"),
        dataQualityStatus: "APPROVED",
        isStorefrontVisible: false,
        name: uniqueLabel("Unsafe Bootstrap Product"),
        recordSource: "IMPORT",
        sellingPrice: new Prisma.Decimal("12.00"),
        sku: uniqueSku("UNSAFE"),
        status: "ACTIVE"
      }
    });

    await prisma.inventoryBatch.create({
      data: {
        batchCode: uniqueLabel("UNSAFE-BATCH"),
        productId: product.id,
        quantityReceived: 2,
        quantityRemaining: 2,
        receivedAt: new Date(),
        status: "AVAILABLE",
        unitCost: new Prisma.Decimal("8.00")
      }
    });

    await assert.rejects(
      () => ensureCatalogInventoryShells({ productIds: [product.id] }),
      /requires manual review because stock evidence already exists/
    );
    assert.equal(await prisma.inventory.findUnique({ where: { productId: product.id } }), null);
  }
);

test(
  "dashboard inventory parity counts unavailable catalog products that already have inventory shells",
  { concurrency: false },
  async () => {
    const now = new Date("2026-09-08T08:00:00.000Z");
    const before = await getDashboardSummary("STAFF", now);
    const category = await createCategory({ name: uniqueLabel("Inactive Dashboard Category") });

    await createProduct({
      categoryId: category.id,
      costPrice: "10.00",
      dataQualityStatus: "APPROVED",
      isStorefrontVisible: false,
      name: uniqueLabel("Inactive Dashboard Product"),
      reorderLevel: 2,
      sellingPrice: "15.00",
      sku: uniqueSku("DASH-INACTIVE"),
      status: "INACTIVE",
      targetStockLevel: 5,
      unit: "PIECE"
    });

    const after = await getDashboardSummary("STAFF", now);

    assert.equal(after.inventory.catalogItems, before.inventory.catalogItems + 1);
    assert.equal(after.inventory.trackedItems, before.inventory.trackedItems + 1);
    assert.equal(after.inventory.unavailableItems, before.inventory.unavailableItems + 1);
    assert.equal(after.inventory.availableItems, before.inventory.availableItems);
    assert.equal(after.inventory.unlinkedCatalogItems, before.inventory.unlinkedCatalogItems);
    assert.equal(after.inventory.outOfStockItems, before.inventory.outOfStockItems);
  }
);

test(
  "dashboard summary reflects live sales, stock, and near-expiry state",
  { concurrency: false },
  async () => {
    const now = new Date("2026-09-08T08:00:00.000Z");
    const before = await getDashboardSummary("STAFF", now);
    const category = await createCategory({ name: uniqueLabel("Dashboard Category") });
    const product = await createProduct({
      categoryId: category.id,
      costPrice: "10.00",
      dataQualityStatus: "APPROVED",
      isStorefrontVisible: false,
      name: uniqueLabel("Dashboard Product"),
      reorderLevel: 5,
      sellingPrice: "15.00",
      sku: uniqueSku("DASH"),
      status: "ACTIVE",
      targetStockLevel: 10,
      unit: "PIECE"
    });

    await addStock(product.id, {
      batchCode: uniqueLabel("DASH-BATCH"),
      expiresAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      quantity: 2
    });

    await prisma.sale.create({
      data: {
        saleDate: new Date("2026-09-08T04:15:00.000Z"),
        saleNumber: uniqueLabel("DASH-SALE"),
        status: "COMPLETED",
        subtotalAmount: new Prisma.Decimal("25.00"),
        totalAmount: new Prisma.Decimal("25.00")
      }
    });

    const after = await getDashboardSummary("STAFF", now);
    const beforeActivityCount = before.sales.activity.reduce(
      (sum, bucket) => sum + bucket.saleCount,
      0
    );
    const afterActivityCount = after.sales.activity.reduce(
      (sum, bucket) => sum + bucket.saleCount,
      0
    );

    assert.equal(after.sales.completedSales, before.sales.completedSales + 1);
    assert.equal(Number(after.sales.todayAmount), Number(before.sales.todayAmount) + 25);
    assert.equal(afterActivityCount, beforeActivityCount + 1);
    assert.equal(after.inventory.catalogItems, before.inventory.catalogItems + 1);
    assert.equal(after.inventory.trackedItems, before.inventory.trackedItems + 1);
    assert.equal(after.inventory.availableItems, before.inventory.availableItems + 1);
    assert.equal(after.inventory.lowStockItems, before.inventory.lowStockItems + 1);
    assert.equal(after.expiry.nearExpiryBatches, before.expiry.nearExpiryBatches + 1);
    assert.equal(after.forecast.access, "RESTRICTED");
  }
);

function uniqueLabel(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function uniqueSku(prefix: string) {
  return `${prefix}-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}
