import type { Prisma } from "@prisma/client";

import { HttpError } from "../utils/httpError.js";
import { calculateStockTruth } from "./stockTruth.js";

type StockTransaction = Prisma.TransactionClient;

/**
 * One lock order for POS, Storefront, restock receiving and manual adjustments.
 * Call BEFORE reading batches/reservations; transactions must use READ COMMITTED.
 */
export async function lockProductStock(tx: StockTransaction, productIds: readonly string[]) {
  for (const id of [...new Set(productIds)].sort()) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM products WHERE id = ${id} FOR UPDATE
    `;
    if (rows.length !== 1) {
      throw new HttpError(404, "Product is no longer available.", {
        code: "PRODUCT_NOT_FOUND",
        details: { productId: id }
      });
    }
  }
}

export async function activeReservationsByProduct(
  tx: StockTransaction,
  productIds: readonly string[],
  excludeOrderId?: string
) {
  const ids = [...new Set(productIds)];
  const reserved = new Map<string, number>();
  if (!ids.length) return reserved;

  const records = await tx.inventoryReservation.groupBy({
    by: ["productId"],
    where: {
      productId: { in: ids },
      status: "ACTIVE",
      ...(excludeOrderId ? { orderId: { not: excludeOrderId } } : {})
    },
    _sum: { quantity: true }
  });
  for (const record of records) reserved.set(record.productId, record._sum.quantity ?? 0);
  return reserved;
}

export function availableToPromise(sellable: number, reserved: number) {
  if (!Number.isSafeInteger(sellable) || !Number.isSafeInteger(reserved) ||
      sellable < 0 || reserved < 0) {
    throw new HttpError(409, "Stock position requires reconciliation.", {
      code: "STOCK_POSITION_INVALID"
    });
  }
  if (reserved > sellable) {
    throw new HttpError(409, "Reservations exceed current sellable stock.", {
      code: "STOCK_RESERVATIONS_EXCEED_STOCK"
    });
  }
  return sellable - reserved;
}

/** Caller must hold all affected product locks. New orders only. */
export async function reserveStorefrontItems(
  tx: StockTransaction,
  orderId: string,
  lines: readonly { productId: string; quantity: number }[]
) {
  const ids = lines.map((line) => line.productId);
  const products = await tx.product.findMany({
    select: {
      id: true,
      inventoryBatches: {
        select: { expiresAt: true, quantityRemaining: true, status: true }
      }
    },
    where: { id: { in: ids } }
  });
  const byProduct = new Map(products.map((product) => [product.id, product]));
  const reservations = await activeReservationsByProduct(tx, ids);

  for (const line of lines) {
    const product = byProduct.get(line.productId);
    if (!product || !Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      throw new HttpError(422, "The order contains an invalid product or quantity.", {
        code: "INVALID_ORDER_STOCK_CLAIM"
      });
    }
    const sellable = calculateStockTruth(product.inventoryBatches).sellableStock;
    const available = availableToPromise(sellable, reservations.get(line.productId) ?? 0);
    if (line.quantity > available) {
      throw new HttpError(409, "Some items were claimed by another checkout.", {
        code: "INSUFFICIENT_STOCK",
        details: { productId: line.productId, available, requested: line.quantity }
      });
    }
  }

  await tx.inventoryReservation.createMany({
    data: lines.map((line) => ({
      orderId,
      productId: line.productId,
      quantity: line.quantity,
      status: "ACTIVE"
    }))
  });
}

/** Caller must hold affected product locks. This never reactivates reservations. */
export async function changeOrderReservations(
  tx: StockTransaction,
  orderId: string,
  next: "CONSUMED" | "RELEASED"
) {
  return tx.inventoryReservation.updateMany({
    where: { orderId, status: "ACTIVE" },
    data: {
      status: next,
      ...(next === "CONSUMED" ? { consumedAt: new Date() } : { releasedAt: new Date() })
    }
  });
}

/** A managed order cannot be fulfilled if its stock reservation was released. */
export async function verifyFulfillmentReservation(
  tx: StockTransaction,
  order: {
    id: string;
    reservationPolicyVersion: number;
    items: readonly { productId: string; quantity: number }[];
  }
) {
  if (order.reservationPolicyVersion === 0) return false; // Explicit legacy exception.
  const reservations = await tx.inventoryReservation.findMany({
    where: { orderId: order.id, status: "ACTIVE" },
    select: { productId: true, quantity: true }
  });
  const byProduct = new Map(reservations.map((item) => [item.productId, item.quantity]));
  if (reservations.length !== order.items.length ||
      order.items.some((line) => byProduct.get(line.productId) !== line.quantity)) {
    throw new HttpError(409, "Order stock reservation needs Owner review.", {
      code: "ORDER_RESERVATION_UNAVAILABLE"
    });
  }
  return true;
}
