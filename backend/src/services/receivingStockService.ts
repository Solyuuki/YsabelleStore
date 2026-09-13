import { Prisma } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import type { StockInRequest } from "../validators/inventory.validators.js";
import {
  serializeMovement,
  type InventorySummaryRow,
  type MovementSummary
} from "./catalogSerializers.js";
import { enrollReceivingBarcodeInTransaction } from "./productBarcodeService.js";
import { stockInBatch } from "./stockDomainService.js";

export type ReceivingStockResult = {
  inventory: InventorySummaryRow;
  movement: MovementSummary;
};

export type ReceivingStockOptions = {
  unitCost?: Prisma.Decimal;
};

function isKnownPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

/**
 * Shared receiving engine for any transaction that needs barcode-aware stock creation.
 * Callers that already own a Prisma transaction (for example Restock Arrived) use this
 * function directly so barcode enrollment, batch creation, movement history and inventory
 * aggregate synchronization remain one atomic operation.
 */
export async function receiveStockInTransaction(
  tx: Prisma.TransactionClient,
  productId: string,
  input: StockInRequest,
  performedById?: string,
  options: ReceivingStockOptions = {}
): Promise<ReceivingStockResult> {
  if (input.scannedBarcode) {
    await enrollReceivingBarcodeInTransaction(tx, {
      productId,
      barcode: input.scannedBarcode,
      confirmed: input.confirmNewBarcode ?? false,
      registeredById: performedById,
      sourceReference: input.referenceId
        ? `inventory-stock-in:${input.referenceId}`
        : `inventory-stock-in:${input.batchCode}`
    });
  }

  const batchResult = await stockInBatch(tx, {
    batchCode: input.batchCode,
    expiresAt: input.expiresAt ?? null,
    performedById,
    productId,
    quantity: input.quantity,
    reason: input.reason ?? "Stock in",
    referenceId: input.referenceId ?? null,
    referenceType: input.referenceType ?? "MANUAL_STOCK_IN",
    unitCost: options.unitCost
  });

  return {
    inventory: batchResult.inventory,
    movement: serializeMovement(batchResult.movement)
  };
}

/**
 * Barcode-aware receiving is deliberately atomic: barcode enrollment and stock-in
 * commit together, or neither commits. Unknown barcodes require a confirmed retry;
 * known barcodes proceed immediately; cross-product conflicts are blocked by the
 * centralized barcode identity service.
 */
export async function receiveStock(
  productId: string,
  input: StockInRequest,
  performedById?: string
): Promise<ReceivingStockResult> {
  try {
    return await prisma.$transaction(async (tx) =>
      receiveStockInTransaction(tx, productId, input, performedById)
    );
  } catch (error) {
    if (isKnownPrismaError(error) && error.code === "P2002") {
      throw new HttpError(409, "Stock update conflicted with an existing record.", {
        code: "INVENTORY_CONFLICT"
      });
    }

    throw error;
  }
}
