import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import { confirmCodCollected } from "../src/services/deliveryService.js";
import { checkoutPosSale } from "../src/services/posService.js";
import { activeReservationsByProduct } from "../src/services/stockReservationService.js";
import { createStorefrontOrder } from "../src/services/storefrontService.js";

/**
 * This test MUTATES DATA. It is hard-gated to the dedicated disposable CI
 * MySQL database, never localhost/ysabellestore or an operator workstation.
 */
const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const EPHEMERAL =
  process.env.CI === "true" &&
  process.env.YS_RESERVATION_EPHEMERAL_QA === "1" &&
  url?.pathname === "/ys_stock_concurrency_ci";

test("real MySQL POS + Storefront share stock safely under simultaneous commits", {
  skip: !EPHEMERAL,
  concurrency: false
}, async () => {
  const unique = randomUUID().slice(0, 8);
  const category = await prisma.category.create({
    data: {
      name: `Reservation QA ${unique}`,
      slug: `reservation-qa-${unique}`,
      dataQualityStatus: "APPROVED",
      isStorefrontVisible: true
    }
  });
  const cashier = await prisma.user.create({
    data: {
      name: `QA Cashier ${unique}`,
      email: `qa-cashier-${unique}@example.invalid`,
      passwordHash: "TEST_ONLY_NOT_FOR_LOGIN",
      role: "STAFF"
    }
  });

  const makeProduct = async (suffix: string) => prisma.product.create({
    data: {
      categoryId: category.id,
      sku: `QA-RES-${unique}-${suffix}`,
      name: `Reservation QA ${suffix}`,
      sellingPrice: "15.00",
      costPrice: "10.00",
      status: "ACTIVE",
      dataQualityStatus: "APPROVED",
      isStorefrontVisible: true,
      inventory: { create: { quantityOnHand: 10 } },
      inventoryBatches: {
        create: {
          batchCode: `QA-BATCH-${unique}-${suffix}`,
          quantityReceived: 10,
          quantityRemaining: 10,
          status: "AVAILABLE",
          unitCost: "10.00"
        }
      }
    }
  });

  const pos = (productId: string, quantity: number) =>
    checkoutPosSale({
      cashierId: cashier.id,
      cashierName: cashier.name,
      cashReceived: "1000.00",
      items: [{ productId, quantity }]
    });
  const storefront = (productId: string, quantity: number) =>
    createStorefrontOrder({
      customerName: "Concurrent QA Customer",
      customerPhone: "09171234567",
      customerEmail: "concurrency@example.invalid",
      customerAddress: {
        addressLine1: "100 QA Test Street",
        addressLine2: "",
        barangay: "San Antonio",
        cityMunicipality: "Pasig",
        provinceRegion: "Metro Manila",
        postalCode: "1600",
        country: "Philippines"
      },
      fulfillmentMethod: "DELIVERY",
      paymentMethod: "CASH_ON_DELIVERY",
      items: [{ productId, quantity }]
    });

  const position = async (id: string) => {
    const product = await prisma.product.findUniqueOrThrow({
      include: { inventory: true, inventoryBatches: true },
      where: { id }
    });
    const reserved = (await activeReservationsByProduct(prisma, [id])).get(id) ?? 0;
    const physical = product.inventoryBatches.reduce((sum, batch) => sum + batch.quantityRemaining, 0);
    assert.equal(product.inventory?.quantityOnHand, physical);
    assert.ok(reserved >= 0 && reserved <= physical);
    return { physical, reserved, available: physical - reserved };
  };

  try {
    const conflict = await makeProduct("conflict");
    const conflicting = await Promise.allSettled([pos(conflict.id, 7), storefront(conflict.id, 6)]);
    assert.equal(conflicting.filter((result) => result.status === "fulfilled").length, 1);
    const first = await position(conflict.id);
    assert.ok(first.available >= 0);
    assert.equal(first.physical - first.reserved <= 10, true);

    const split = await makeProduct("split");
    const both = await Promise.allSettled([pos(split.id, 7), storefront(split.id, 3)]);
    assert.equal(both.filter((result) => result.status === "fulfilled").length, 2, JSON.stringify(both));
    assert.deepEqual(await position(split.id), { physical: 3, reserved: 3, available: 0 });

    const webOnly = await makeProduct("web");
    const doubleWeb = await Promise.allSettled([storefront(webOnly.id, 6), storefront(webOnly.id, 6)]);
    assert.equal(doubleWeb.filter((result) => result.status === "fulfilled").length, 1);
    assert.deepEqual(await position(webOnly.id), { physical: 10, reserved: 6, available: 4 });

    const cod = await makeProduct("cod");
    const order = await storefront(cod.id, 3);
    await prisma.customerOrder.update({
      where: { id: order.id },
      data: {
        customerConfirmedAt: new Date(),
        deliveredAt: new Date(),
        deliveryStatus: "DELIVERED",
        status: "PROCESSING"
      }
    });
    const settle = await Promise.allSettled([
      confirmCodCollected(order.id, cashier.id, {}),
      confirmCodCollected(order.id, cashier.id, {})
    ]);
    assert.ok(settle.some((result) => result.status === "fulfilled"), JSON.stringify(settle));
    const finalOrder = await prisma.customerOrder.findUniqueOrThrow({
      where: { id: order.id },
      include: { sale: { include: { items: true } } }
    });
    assert.equal(finalOrder.paymentStatus, "PAID");
    assert.ok(finalOrder.saleId);
    assert.equal(finalOrder.sale?.items.reduce((sum, line) => sum + line.quantity, 0), 3);
    assert.deepEqual(await position(cod.id), { physical: 7, reserved: 0, available: 7 });
  } finally {
    await prisma.$disconnect();
  }
});
