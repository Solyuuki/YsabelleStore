import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import { Prisma } from "@prisma/client";

import { prisma } from "../src/database/prismaClient.js";
import { getDashboardSummary } from "../src/services/dashboardService.js";
import {
  getDashboardSalesCalendar,
  getDashboardSalesDay
} from "../src/services/dashboardSalesCalendarService.js";
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
    const now = new Date();
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
        saleDate: now,
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

test(
  "sales calendar groups completed sales by Manila business day",
  { concurrency: false },
  async () => {
    const now = new Date("2026-09-20T04:00:00.000Z");
    const saleDate = new Date("2026-09-18T15:30:00.000Z");
    const beforeCalendar = await getDashboardSalesCalendar("2026-09", "STAFF", now);
    const beforeDay = await getDashboardSalesDay("2026-09-18", now);
    const beforeCalendarDay = beforeCalendar.days.find((day) => day.date === "2026-09-18");
    assert.ok(beforeCalendarDay);

    const category = await createCategory({ name: uniqueLabel("Calendar Category") });
    const product = await createProduct({
      categoryId: category.id,
      costPrice: "8.00",
      dataQualityStatus: "APPROVED",
      isStorefrontVisible: false,
      name: uniqueLabel("Calendar Product"),
      reorderLevel: 2,
      sellingPrice: "12.50",
      sku: uniqueSku("CALENDAR"),
      status: "ACTIVE",
      targetStockLevel: 10,
      unit: "PIECE"
    });

    await prisma.sale.create({
      data: {
        items: {
          create: {
            productId: product.id,
            quantity: 2,
            totalAmount: new Prisma.Decimal("25.00"),
            unitPrice: new Prisma.Decimal("12.50")
          }
        },
        saleDate,
        saleNumber: uniqueLabel("CALENDAR-SALE"),
        status: "COMPLETED",
        subtotalAmount: new Prisma.Decimal("25.00"),
        totalAmount: new Prisma.Decimal("25.00")
      }
    });

    const afterCalendar = await getDashboardSalesCalendar("2026-09", "STAFF", now);
    const afterDay = await getDashboardSalesDay("2026-09-18", now);
    const afterCalendarDay = afterCalendar.days.find((day) => day.date === "2026-09-18");
    assert.ok(afterCalendarDay);

    assert.equal(
      Number(afterCalendarDay.actualAmount),
      Number(beforeCalendarDay.actualAmount) + 25
    );
    assert.equal(afterCalendarDay.completedSales, beforeCalendarDay.completedSales + 1);
    assert.equal(afterCalendarDay.unitsSold, beforeCalendarDay.unitsSold + 2);
    assert.equal(Number(afterDay.actualAmount), Number(beforeDay.actualAmount) + 25);
    assert.equal(afterDay.completedSales, beforeDay.completedSales + 1);
    assert.equal(afterDay.unitsSold, beforeDay.unitsSold + 2);
    assert.equal(
      afterDay.activity.reduce((sum, bucket) => sum + bucket.saleCount, 0),
      beforeDay.activity.reduce((sum, bucket) => sum + bucket.saleCount, 0) + 1
    );
  }
);

test(
  "sales calendar reads durable daily targets without fabricating daily forecasts",
  { concurrency: false },
  async () => {
    const date = "2099-12-31";
    const businessDate = new Date(`${date}T00:00:00.000Z`);

    await prisma.dailySalesTarget.deleteMany({ where: { businessDate } });

    try {
      await prisma.dailySalesTarget.create({
        data: {
          businessDate,
          targetAmount: new Prisma.Decimal("1234.50")
        }
      });

      const calendar = await getDashboardSalesCalendar(
        "2099-12",
        "STAFF",
        new Date("2099-12-01T04:00:00.000Z")
      );
      const day = calendar.days.find((candidate) => candidate.date === date);

      assert.ok(day);
      assert.equal(day.targetAmount, "1234.50");
      assert.equal(day.status, "FUTURE");
      assert.equal(calendar.summary.forecastAmount, null);
      assert.equal(calendar.summary.forecastUnits, null);
    } finally {
      await prisma.dailySalesTarget.deleteMany({ where: { businessDate } });
    }
  }
);

test("sales calendar rejects impossible business dates", async () => {
  await assert.rejects(
    () => getDashboardSalesDay("2026-02-31"),
    /Sales calendar date is invalid/
  );
});

function uniqueLabel(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

function uniqueSku(prefix: string) {
  return `${prefix}-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
}
