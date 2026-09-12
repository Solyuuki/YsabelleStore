import { randomUUID } from "node:crypto";

import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import type { CompleteBulkDeliveryRequest } from "../validators/bulkDelivery.validators.js";
import { receiveStockInTransaction } from "./receivingStockService.js";
import { receiveRestockOrder } from "./restockLifecycleService.js";

function expiryKey(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "NO-EXPIRY";
}

function acceptedQuantity(row: CompleteBulkDeliveryRequest["rows"][number]) {
  return row.acceptedQuantity ?? Math.max(0, row.receivedQuantity - row.damagedQuantity);
}

function rejectedQuantity(row: CompleteBulkDeliveryRequest["rows"][number]) {
  return Math.max(0, row.receivedQuantity - row.damagedQuantity - acceptedQuantity(row));
}

function assertNoDuplicateDeliveryLines(input: CompleteBulkDeliveryRequest) {
  const seen = new Set<string>();

  input.rows.forEach((row, index) => {
    const key = input.restockOrderId
      ? row.restockOrderLineId ?? `UNRESOLVED-${index}`
      : [row.productId, row.batchCode?.trim().toUpperCase() ?? "", expiryKey(row.expiresAt)].join(
          "|"
        );

    if (seen.has(key)) {
      throw new HttpError(
        422,
        input.restockOrderId
          ? "A Restock Order line can appear only once in a bulk delivery session."
          : "Bulk delivery contains a duplicate product/batch/expiry line.",
        {
          code: "BULK_DELIVERY_DUPLICATE_LINE",
          details: {
            rowNumber: index + 1,
            productId: row.productId,
            restockOrderLineId: row.restockOrderLineId ?? null,
            batchCode: row.batchCode ?? null
          }
        }
      );
    }

    seen.add(key);
  });
}

async function completeLinkedRestockDelivery(
  input: CompleteBulkDeliveryRequest,
  performedById: string
) {
  if (!input.restockOrderId || input.expectedOrderVersion === undefined) {
    throw new HttpError(422, "Linked bulk delivery is missing Restock Order identity.", {
      code: "BULK_DELIVERY_RESTOCK_LINK_REQUIRED"
    });
  }

  const order = await receiveRestockOrder(
    input.restockOrderId,
    {
      expectedVersion: input.expectedOrderVersion,
      lines: input.rows.map((row) => ({
        lineId: row.restockOrderLineId ?? "",
        deliveredQuantity: row.receivedQuantity,
        damagedQuantity: row.damagedQuantity,
        damageReason: row.damageReason ?? null,
        acceptedQuantity: acceptedQuantity(row),
        batchCode: acceptedQuantity(row) > 0 ? (row.batchCode ?? null) : null,
        expiresAt: acceptedQuantity(row) > 0 ? (row.expiresAt ?? null) : null,
        noExpiration: acceptedQuantity(row) > 0 ? row.noExpiration : false,
        confirmOverDelivery: row.confirmOverDelivery ?? false
      }))
    },
    performedById
  );

  const selectedLines = order.lines.filter((line) => line.isSelected);
  const remainingUnits = selectedLines.reduce(
    (sum, line) => sum + Math.max(0, line.requestedQuantity - line.receivedQuantity),
    0
  );
  const totalUnitsDelivered = input.rows.reduce((sum, row) => sum + row.receivedQuantity, 0);
  const totalUnitsDamaged = input.rows.reduce((sum, row) => sum + row.damagedQuantity, 0);
  const totalUnitsAccepted = input.rows.reduce((sum, row) => sum + acceptedQuantity(row), 0);
  const totalUnitsRejected = input.rows.reduce((sum, row) => sum + rejectedQuantity(row), 0);

  return {
    sessionId: `DELIVERY-${randomUUID()}`,
    sourceType: input.sourceType,
    sourceFileName: input.sourceFileName ?? null,
    restockOrderId: order.id,
    restockOrderNumber: order.orderNumber,
    restockOrderStatus: order.status,
    restockOrderVersion: order.version,
    totalLines: input.rows.length,
    totalUnitsDelivered,
    totalUnitsReceived: totalUnitsAccepted,
    totalUnitsAccepted,
    totalUnitsDamaged,
    totalUnitsRejected,
    remainingUnits,
    productCount: new Set(input.rows.map((row) => row.productId)).size,
    requiresReturnReport: totalUnitsDamaged + totalUnitsRejected > 0,
    completedAt: new Date().toISOString(),
    rows: input.rows.map((row) => ({
      productId: row.productId,
      restockOrderLineId: row.restockOrderLineId ?? null,
      receivedQuantity: row.receivedQuantity,
      acceptedQuantity: acceptedQuantity(row),
      damagedQuantity: row.damagedQuantity,
      batchCode: row.batchCode ?? null,
      expiresAt: row.noExpiration ? null : (row.expiresAt?.toISOString() ?? null),
      movementId: null
    }))
  };
}

export async function completeBulkDeliverySession(
  input: CompleteBulkDeliveryRequest,
  performedById?: string
) {
  assertNoDuplicateDeliveryLines(input);

  if (input.restockOrderId) {
    if (!performedById) {
      throw new HttpError(401, "Authenticated actor is required for linked Restock receiving.", {
        code: "BULK_DELIVERY_ACTOR_REQUIRED"
      });
    }

    return completeLinkedRestockDelivery(input, performedById);
  }

  const sessionId = `DELIVERY-${randomUUID()}`;
  const completedAt = new Date();

  const results = await prisma.$transaction(async (tx) => {
    const completedRows = [] as Array<{
      productId: string;
      receivedQuantity: number;
      acceptedQuantity: number;
      damagedQuantity: number;
      batchCode: string | null;
      expiresAt: string | null;
      movementId: string;
    }>;

    for (const row of input.rows) {
      const accepted = acceptedQuantity(row);
      const result = await receiveStockInTransaction(
        tx,
        row.productId,
        {
          quantity: accepted,
          batchCode: row.batchCode ?? "",
          expiresAt: row.noExpiration ? null : (row.expiresAt ?? null),
          reason: row.reason ?? "Bulk delivery receipt",
          referenceType: "BULK_DELIVERY",
          referenceId: sessionId
        },
        performedById
      );

      completedRows.push({
        productId: row.productId,
        receivedQuantity: row.receivedQuantity,
        acceptedQuantity: accepted,
        damagedQuantity: row.damagedQuantity,
        batchCode: row.batchCode ?? null,
        expiresAt: row.noExpiration ? null : (row.expiresAt?.toISOString() ?? null),
        movementId: result.movement.id
      });
    }

    return completedRows;
  });

  const totalUnitsDelivered = results.reduce((sum, row) => sum + row.receivedQuantity, 0);
  const totalUnitsAccepted = results.reduce((sum, row) => sum + row.acceptedQuantity, 0);

  return {
    sessionId,
    sourceType: input.sourceType,
    sourceFileName: input.sourceFileName ?? null,
    restockOrderId: null,
    restockOrderNumber: null,
    restockOrderStatus: null,
    restockOrderVersion: null,
    totalLines: results.length,
    totalUnitsDelivered,
    totalUnitsReceived: totalUnitsAccepted,
    totalUnitsAccepted,
    totalUnitsDamaged: 0,
    totalUnitsRejected: 0,
    remainingUnits: 0,
    productCount: new Set(results.map((row) => row.productId)).size,
    requiresReturnReport: false,
    completedAt: completedAt.toISOString(),
    rows: results.map((row) => ({
      ...row,
      restockOrderLineId: null
    }))
  };
}
