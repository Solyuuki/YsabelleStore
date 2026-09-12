import { randomUUID } from "node:crypto";

import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import type { CompleteBulkDeliveryRequest } from "../validators/bulkDelivery.validators.js";
import { receiveStockInTransaction } from "./receivingStockService.js";

function expiryKey(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "NO-EXPIRY";
}

function assertNoDuplicateDeliveryLines(input: CompleteBulkDeliveryRequest) {
  const seen = new Set<string>();

  input.rows.forEach((row, index) => {
    const key = [row.productId, row.batchCode.trim().toUpperCase(), expiryKey(row.expiresAt)].join(
      "|"
    );

    if (seen.has(key)) {
      throw new HttpError(422, "Bulk delivery contains a duplicate product/batch/expiry line.", {
        code: "BULK_DELIVERY_DUPLICATE_LINE",
        details: {
          rowNumber: index + 1,
          productId: row.productId,
          batchCode: row.batchCode
        }
      });
    }

    seen.add(key);
  });
}

export async function completeBulkDeliverySession(
  input: CompleteBulkDeliveryRequest,
  performedById?: string
) {
  assertNoDuplicateDeliveryLines(input);

  const sessionId = `DELIVERY-${randomUUID()}`;
  const completedAt = new Date();

  const results = await prisma.$transaction(async (tx) => {
    const completedRows = [] as Array<{
      productId: string;
      receivedQuantity: number;
      batchCode: string;
      expiresAt: string | null;
      movementId: string;
    }>;

    for (const row of input.rows) {
      const result = await receiveStockInTransaction(
        tx,
        row.productId,
        {
          quantity: row.receivedQuantity,
          batchCode: row.batchCode,
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
        batchCode: row.batchCode,
        expiresAt: row.noExpiration ? null : (row.expiresAt?.toISOString() ?? null),
        movementId: result.movement.id
      });
    }

    return completedRows;
  });

  return {
    sessionId,
    sourceType: input.sourceType,
    sourceFileName: input.sourceFileName ?? null,
    totalLines: results.length,
    totalUnitsReceived: results.reduce((sum, row) => sum + row.receivedQuantity, 0),
    productCount: new Set(results.map((row) => row.productId)).size,
    completedAt: completedAt.toISOString(),
    rows: results
  };
}
