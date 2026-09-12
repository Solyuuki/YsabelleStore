import { Prisma, RestockOrderStatus } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import type {
  AdvanceRestockOrderRequest,
  CancelRestockOrderRequest,
  ReceiveRestockOrderRequest
} from "../validators/restock.validators.js";
import { receiveStockInTransaction } from "./receivingStockService.js";
import { getRestockOrder } from "./restockService.js";

const RECEIVABLE_STATUSES = [
  RestockOrderStatus.APPROVED,
  RestockOrderStatus.AWAITING_DELIVERY,
  RestockOrderStatus.PARTIALLY_RECEIVED
] as const;

const CANCELLABLE_STATUSES = [
  RestockOrderStatus.DRAFT,
  RestockOrderStatus.APPROVED,
  RestockOrderStatus.AWAITING_DELIVERY
] as const;

function appendBoundedAuditNote(existing: string | null, event: string, maxLength: number) {
  const next = [existing?.trim(), event.trim()].filter(Boolean).join("\n");
  if (next.length <= maxLength) return next;

  const suffix = next.slice(-(maxLength - 3));
  return `...${suffix}`;
}

function assertVersion(
  order: { id: string; version: number },
  expectedVersion: number,
  code = "RESTOCK_ORDER_VERSION_CONFLICT"
) {
  if (order.version !== expectedVersion) {
    throw new HttpError(409, "The restock order changed elsewhere. Refresh and try again.", {
      code,
      details: {
        currentVersion: order.version,
        expectedVersion,
        orderId: order.id
      }
    });
  }
}

function auditStamp(action: string, actorId: string, detail?: string) {
  const base = `[${action} ${new Date().toISOString()} actor=${actorId}]`;
  return detail ? `${base} ${detail}` : base;
}

export async function markRestockOrderAwaitingDelivery(
  orderId: string,
  input: AdvanceRestockOrderRequest,
  actorId: string
) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.restockOrder.findUnique({
      select: { id: true, notes: true, status: true, version: true },
      where: { id: orderId }
    });

    if (!existing) {
      throw new HttpError(404, "Restock order was not found.", {
        code: "RESTOCK_ORDER_NOT_FOUND"
      });
    }
    assertVersion(existing, input.expectedVersion);

    if (existing.status !== RestockOrderStatus.APPROVED) {
      throw new HttpError(409, "Only confirmed restock orders can move to awaiting delivery.", {
        code: "RESTOCK_ORDER_NOT_APPROVED",
        details: { orderId, status: existing.status }
      });
    }

    const updated = await tx.restockOrder.updateMany({
      data: {
        notes: appendBoundedAuditNote(
          existing.notes,
          auditStamp("AWAITING_DELIVERY", actorId),
          1000
        ),
        status: RestockOrderStatus.AWAITING_DELIVERY,
        version: { increment: 1 }
      },
      where: {
        id: orderId,
        status: RestockOrderStatus.APPROVED,
        version: input.expectedVersion
      }
    });

    if (updated.count !== 1) {
      throw new HttpError(409, "The restock order changed elsewhere. Refresh and try again.", {
        code: "RESTOCK_ORDER_VERSION_CONFLICT"
      });
    }
  });

  return getRestockOrder(orderId);
}

export async function cancelRestockOrder(
  orderId: string,
  input: CancelRestockOrderRequest,
  actorId: string
) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.restockOrder.findUnique({
      include: {
        lines: {
          select: { receivedQuantity: true }
        }
      },
      where: { id: orderId }
    });

    if (!existing) {
      throw new HttpError(404, "Restock order was not found.", {
        code: "RESTOCK_ORDER_NOT_FOUND"
      });
    }
    assertVersion(existing, input.expectedVersion);

    if (!CANCELLABLE_STATUSES.includes(existing.status as (typeof CANCELLABLE_STATUSES)[number])) {
      throw new HttpError(409, "This restock order can no longer be cancelled.", {
        code: "RESTOCK_ORDER_NOT_CANCELLABLE",
        details: { orderId, status: existing.status }
      });
    }

    if (existing.lines.some((line) => line.receivedQuantity > 0)) {
      throw new HttpError(409, "A restock order with received inventory cannot be cancelled.", {
        code: "RESTOCK_ORDER_HAS_RECEIPTS"
      });
    }

    const updated = await tx.restockOrder.updateMany({
      data: {
        notes: appendBoundedAuditNote(
          existing.notes,
          auditStamp("CANCELLED", actorId, `reason=${input.reason}`),
          1000
        ),
        status: RestockOrderStatus.CANCELLED,
        version: { increment: 1 }
      },
      where: {
        id: orderId,
        status: existing.status,
        version: input.expectedVersion
      }
    });

    if (updated.count !== 1) {
      throw new HttpError(409, "The restock order changed elsewhere. Refresh and try again.", {
        code: "RESTOCK_ORDER_VERSION_CONFLICT"
      });
    }
  });

  return getRestockOrder(orderId);
}

export async function receiveRestockOrder(
  orderId: string,
  input: ReceiveRestockOrderRequest,
  actorId: string
) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.restockOrder.findUnique({
      include: {
        lines: {
          include: {
            product: {
              select: { id: true, status: true }
            }
          }
        }
      },
      where: { id: orderId }
    });

    if (!order) {
      throw new HttpError(404, "Restock order was not found.", {
        code: "RESTOCK_ORDER_NOT_FOUND"
      });
    }
    assertVersion(order, input.expectedVersion);

    if (!RECEIVABLE_STATUSES.includes(order.status as (typeof RECEIVABLE_STATUSES)[number])) {
      throw new HttpError(409, "This restock order is not ready for receiving.", {
        code: "RESTOCK_ORDER_NOT_RECEIVABLE",
        details: { orderId, status: order.status }
      });
    }

    // Optimistic version claim happens before physical stock mutation. Concurrent or duplicate
    // submissions using the same order version fail here and roll back without touching inventory.
    const versionClaim = await tx.restockOrder.updateMany({
      data: { version: { increment: 1 } },
      where: {
        id: orderId,
        status: { in: [...RECEIVABLE_STATUSES] },
        version: input.expectedVersion
      }
    });

    if (versionClaim.count !== 1) {
      throw new HttpError(409, "This delivery was already submitted or the order changed. Refresh and review the latest receipt state.", {
        code: "RESTOCK_RECEIPT_VERSION_CONFLICT"
      });
    }

    const lineById = new Map(order.lines.map((line) => [line.id, line]));

    for (const receiptLine of input.lines) {
      const orderLine = lineById.get(receiptLine.lineId);
      if (!orderLine || !orderLine.isSelected) {
        throw new HttpError(422, "A receipt line does not belong to the selected restock order lines.", {
          code: "RESTOCK_RECEIPT_LINE_MISMATCH",
          details: { lineId: receiptLine.lineId }
        });
      }

      const remaining = Math.max(0, orderLine.requestedQuantity - orderLine.receivedQuantity);
      if (receiptLine.acceptedQuantity > remaining && !receiptLine.confirmOverDelivery) {
        throw new HttpError(422, "Accepted quantity exceeds the remaining order quantity. Confirm the over-delivery before receiving it.", {
          code: "RESTOCK_OVER_DELIVERY_CONFIRMATION_REQUIRED",
          details: {
            acceptedQuantity: receiptLine.acceptedQuantity,
            lineId: receiptLine.lineId,
            remainingQuantity: remaining
          }
        });
      }

      if (receiptLine.acceptedQuantity > 0 && orderLine.product.status === "DISCONTINUED") {
        throw new HttpError(422, "Discontinued products cannot create new sellable stock from a restock receipt.", {
          code: "RESTOCK_PRODUCT_DISCONTINUED",
          details: { productId: orderLine.productId }
        });
      }

      const referenceId = `${order.id}:${orderLine.id}:v${input.expectedVersion}`;
      const receiptReason = [
        `Restock ${order.orderNumber}`,
        `delivered ${receiptLine.deliveredQuantity}`,
        `damaged ${receiptLine.damagedQuantity}`,
        `accepted ${receiptLine.acceptedQuantity}`
      ].join("; ");

      if (receiptLine.acceptedQuantity > 0) {
        await receiveStockInTransaction(
          tx,
          orderLine.productId,
          {
            batchCode: receiptLine.batchCode ?? "",
            confirmNewBarcode: receiptLine.confirmNewBarcode ?? false,
            expiresAt: receiptLine.noExpiration ? null : (receiptLine.expiresAt ?? null),
            quantity: receiptLine.acceptedQuantity,
            reason: receiptReason,
            referenceId,
            referenceType: "RESTOCK_RECEIPT",
            scannedBarcode: receiptLine.scannedBarcode ?? undefined
          },
          actorId,
          {
            unitCost:
              receiptLine.unitCost === undefined
                ? undefined
                : new Prisma.Decimal(receiptLine.unitCost)
          }
        );
      }

      const discrepancy =
        receiptLine.deliveredQuantity - receiptLine.damagedQuantity - receiptLine.acceptedQuantity;
      const lineAudit = auditStamp(
        "RECEIPT",
        actorId,
        [
          `delivered=${receiptLine.deliveredQuantity}`,
          `damaged=${receiptLine.damagedQuantity}`,
          `accepted=${receiptLine.acceptedQuantity}`,
          `other_rejected=${Math.max(0, discrepancy)}`,
          receiptLine.batchCode ? `batch=${receiptLine.batchCode}` : null,
          receiptLine.noExpiration
            ? "expiry=NONE"
            : receiptLine.expiresAt
              ? `expiry=${receiptLine.expiresAt.toISOString().slice(0, 10)}`
              : null
        ]
          .filter(Boolean)
          .join(" ")
      );

      await tx.restockOrderLine.update({
        data: {
          notes: appendBoundedAuditNote(orderLine.notes, lineAudit, 500),
          receivedQuantity: { increment: receiptLine.acceptedQuantity }
        },
        where: { id: orderLine.id }
      });
    }

    const refreshedLines = await tx.restockOrderLine.findMany({
      select: {
        isSelected: true,
        receivedQuantity: true,
        requestedQuantity: true
      },
      where: { restockOrderId: orderId }
    });
    const selectedLines = refreshedLines.filter((line) => line.isSelected);
    const allFulfilled =
      selectedLines.length > 0 &&
      selectedLines.every((line) => line.receivedQuantity >= line.requestedQuantity);
    const anyReceived = selectedLines.some((line) => line.receivedQuantity > 0);
    const nextStatus = allFulfilled
      ? RestockOrderStatus.RECEIVED
      : anyReceived
        ? RestockOrderStatus.PARTIALLY_RECEIVED
        : RestockOrderStatus.AWAITING_DELIVERY;
    const deliveredTotal = input.lines.reduce((sum, line) => sum + line.deliveredQuantity, 0);
    const damagedTotal = input.lines.reduce((sum, line) => sum + line.damagedQuantity, 0);
    const acceptedTotal = input.lines.reduce((sum, line) => sum + line.acceptedQuantity, 0);

    await tx.restockOrder.update({
      data: {
        notes: appendBoundedAuditNote(
          order.notes,
          auditStamp(
            "DELIVERY",
            actorId,
            `delivered=${deliveredTotal} damaged=${damagedTotal} accepted=${acceptedTotal}`
          ),
          1000
        ),
        status: nextStatus
      },
      where: { id: orderId }
    });
  });

  return getRestockOrder(orderId);
}
