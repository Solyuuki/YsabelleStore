import { randomBytes } from "node:crypto";

import {
  CustomerDeliveryActorType,
  CustomerDeliveryStatus,
  CustomerOrderStatus,
  CustomerPaymentMethod,
  CustomerPaymentStatus,
  Prisma,
  SaleStatus
} from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { invalidateForecastCache } from "../modules/forecasting/forecast.service.js";
import { HttpError } from "../utils/httpError.js";
import type {
  CodSettlementInput,
  DeliveryListQuery,
  DeliveryTransitionInput
} from "../validators/delivery.validators.js";
import {
  allocateStockForSale,
  assertStockInvariant,
  createInventoryMovementAfterAllocation,
  synchronizeInventoryAggregate
} from "./stockDomainService.js";

const deliveryOrderInclude = {
  addressSnapshot: true,
  codCollectedBy: { select: { id: true, name: true } },
  deliveryEvents: {
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }]
  },
  items: { include: { product: true } },
  sale: { select: { id: true, saleNumber: true } }
} satisfies Prisma.CustomerOrderInclude;

type DeliveryOrderRecord = Prisma.CustomerOrderGetPayload<{
  include: typeof deliveryOrderInclude;
}>;

type TransactionClient = Prisma.TransactionClient;

const ALLOWED_TRANSITIONS: Record<CustomerDeliveryStatus, readonly CustomerDeliveryStatus[]> = {
  ORDER_PLACED: [CustomerDeliveryStatus.PREPARING, CustomerDeliveryStatus.CANCELLED],
  PREPARING: [CustomerDeliveryStatus.READY_FOR_DELIVERY, CustomerDeliveryStatus.CANCELLED],
  READY_FOR_DELIVERY: [CustomerDeliveryStatus.OUT_FOR_DELIVERY, CustomerDeliveryStatus.CANCELLED],
  OUT_FOR_DELIVERY: [CustomerDeliveryStatus.DELIVERY_FAILED],
  DELIVERED: [],
  DELIVERY_FAILED: [CustomerDeliveryStatus.READY_FOR_DELIVERY, CustomerDeliveryStatus.CANCELLED],
  CANCELLED: []
};

export function canTransitionDeliveryStatus(
  current: CustomerDeliveryStatus,
  target: CustomerDeliveryStatus
) {
  return ALLOWED_TRANSITIONS[current].includes(target);
}

export function deliveryStatusLabel(status: CustomerDeliveryStatus) {
  switch (status) {
    case CustomerDeliveryStatus.ORDER_PLACED:
      return "Order placed";
    case CustomerDeliveryStatus.PREPARING:
      return "Preparing";
    case CustomerDeliveryStatus.READY_FOR_DELIVERY:
      return "Ready for delivery";
    case CustomerDeliveryStatus.OUT_FOR_DELIVERY:
      return "On the way";
    case CustomerDeliveryStatus.DELIVERED:
      return "Delivered";
    case CustomerDeliveryStatus.DELIVERY_FAILED:
      return "Delivery failed";
    case CustomerDeliveryStatus.CANCELLED:
      return "Cancelled";
  }
}

export function isPaymongoPaymentPending(order: {
  paymentMethod: CustomerPaymentMethod;
  paymentStatus: CustomerPaymentStatus;
}) {
  return (
    order.paymentMethod === CustomerPaymentMethod.PAYMONGO &&
    order.paymentStatus !== CustomerPaymentStatus.PAID
  );
}

export function isCodSettlementReady(order: {
  customerConfirmedAt: Date | null;
  deliveryStatus: CustomerDeliveryStatus;
  paymentMethod: CustomerPaymentMethod;
}) {
  return (
    order.paymentMethod === CustomerPaymentMethod.CASH_ON_DELIVERY &&
    order.deliveryStatus === CustomerDeliveryStatus.DELIVERED &&
    order.customerConfirmedAt !== null
  );
}

function serializeAddress(address: DeliveryOrderRecord["addressSnapshot"]) {
  if (!address) return null;
  return {
    addressLine1: address.addressLine1,
    addressLine2: address.addressLine2,
    barangay: address.barangay,
    cityMunicipality: address.cityMunicipality,
    provinceRegion: address.provinceRegion,
    postalCode: address.postalCode,
    country: address.country
  };
}

export function serializeDeliveryOrder(order: DeliveryOrderRecord) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    deliveryTicketNumber: order.deliveryTicketNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    status: order.status,
    fulfillmentMethod: order.fulfillmentMethod,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    deliveryStatus: order.deliveryStatus,
    deliveryStatusLabel: deliveryStatusLabel(order.deliveryStatus),
    courierProvider: order.courierProvider,
    courierReference: order.courierReference,
    deliveryNotes: order.deliveryNotes,
    dispatchedAt: order.dispatchedAt,
    deliveredAt: order.deliveredAt,
    customerConfirmedAt: order.customerConfirmedAt,
    codCollectedAt: order.codCollectedAt,
    codCollectedBy: order.codCollectedBy,
    paidAt: order.paidAt,
    sale: order.sale,
    totalAmount: order.totalAmount.toString(),
    subtotalAmount: order.subtotalAmount.toString(),
    notes: order.notes,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    address: serializeAddress(order.addressSnapshot),
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    items: order.items.map((item) => ({
      productId: item.productId,
      productName: item.product.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toString(),
      totalAmount: item.totalAmount.toString()
    })),
    timeline: order.deliveryEvents.map((event) => ({
      id: event.id,
      status: event.status,
      label: deliveryStatusLabel(event.status),
      actorType: event.actorType,
      note: event.note,
      createdAt: event.createdAt
    })),
    canCustomerConfirmReceipt:
      order.deliveryStatus === CustomerDeliveryStatus.OUT_FOR_DELIVERY &&
      order.customerAccountId !== null,
    canConfirmCodCollected:
      isCodSettlementReady(order) && order.paymentStatus !== CustomerPaymentStatus.PAID
  };
}

async function findDeliveryOrder(tx: TransactionClient, orderId: string) {
  const order = await tx.customerOrder.findUnique({
    include: deliveryOrderInclude,
    where: { id: orderId }
  });
  if (!order) {
    throw new HttpError(404, "Delivery ticket was not found.", {
      code: "DELIVERY_TICKET_NOT_FOUND"
    });
  }
  return order;
}

async function finalizeOrderSale(
  tx: TransactionClient,
  order: DeliveryOrderRecord,
  actorUserId?: string
) {
  if (order.saleId) {
    return { created: false, productIds: order.items.map((item) => item.productId) };
  }

  const sale = await tx.sale.create({
    data: {
      cashierId: actorUserId ?? null,
      discountAmount: new Prisma.Decimal(0),
      notes: `Delivery ticket ${order.deliveryTicketNumber} · ${order.paymentMethod}`,
      saleDate: new Date(),
      saleNumber: createDeliverySaleNumber(order.orderNumber),
      status: SaleStatus.COMPLETED,
      subtotalAmount: order.subtotalAmount,
      totalAmount: order.totalAmount
    }
  });

  for (const line of order.items) {
    const inventory = await tx.inventory.findUnique({ where: { productId: line.productId } });
    if (!inventory) {
      throw new HttpError(409, "Inventory record is missing for a delivery item.", {
        code: "DELIVERY_INVENTORY_NOT_FOUND",
        details: { productId: line.productId }
      });
    }

    const quantityBefore = inventory.quantityOnHand;
    const allocations = await allocateStockForSale(tx, {
      productId: line.productId,
      quantity: line.quantity
    });

    for (const allocation of allocations) {
      await tx.saleItem.create({
        data: {
          batchId: allocation.batchId,
          productId: line.productId,
          quantity: allocation.quantity,
          saleId: sale.id,
          totalAmount: line.unitPrice.mul(allocation.quantity),
          unitPrice: line.unitPrice
        }
      });
    }

    const syncResult = await synchronizeInventoryAggregate(tx, line.productId);
    await createInventoryMovementAfterAllocation(tx, {
      batchId: allocations[0]?.batchId ?? null,
      inventoryId: inventory.id,
      performedById: actorUserId,
      productId: line.productId,
      quantity: line.quantity,
      quantityBefore,
      quantityAfter: syncResult.batchTotal,
      reason: `Customer delivery ${order.deliveryTicketNumber}`,
      referenceId: order.id,
      referenceType: "CUSTOMER_ORDER",
      type: "SALE"
    });
    await assertStockInvariant(tx, line.productId);
  }

  await tx.customerOrder.update({
    data: { saleId: sale.id, status: CustomerOrderStatus.COMPLETED },
    where: { id: order.id }
  });

  return { created: true, productIds: order.items.map((item) => item.productId) };
}

function createDeliverySaleNumber(orderNumber: string) {
  const suffix = randomBytes(2).toString("hex").toUpperCase();
  return `WEB-${orderNumber}-${suffix}`.slice(0, 80);
}

async function invalidateProducts(productIds: string[]) {
  if (productIds.length > 0) invalidateForecastCache([...new Set(productIds)]);
}

export async function listDeliveryTickets(query: DeliveryListQuery) {
  const search = query.search?.trim();
  const where: Prisma.CustomerOrderWhereInput = {
    ...(query.status ? { deliveryStatus: query.status } : {}),
    ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
    ...(search
      ? {
          OR: [
            { deliveryTicketNumber: { contains: search } },
            { orderNumber: { contains: search } },
            { customerName: { contains: search } },
            { customerPhone: { contains: search } }
          ]
        }
      : {})
  };

  const [totalItems, items, grouped] = await Promise.all([
    prisma.customerOrder.count({ where }),
    prisma.customerOrder.findMany({
      include: deliveryOrderInclude,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      where
    }),
    prisma.customerOrder.groupBy({
      _count: { _all: true },
      by: ["deliveryStatus"]
    })
  ]);

  const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));
  const summary = Object.fromEntries(
    Object.values(CustomerDeliveryStatus).map((status) => [status, 0])
  ) as Record<CustomerDeliveryStatus, number>;
  for (const row of grouped) summary[row.deliveryStatus] = row._count._all;

  return {
    items: items.map(serializeDeliveryOrder),
    meta: {
      page: Math.min(query.page, totalPages),
      pageSize: query.pageSize,
      totalItems,
      totalPages
    },
    summary
  };
}

export async function updateDeliveryStatus(
  orderId: string,
  actorUserId: string,
  input: DeliveryTransitionInput
) {
  return prisma.$transaction(async (tx) => {
    const order = await findDeliveryOrder(tx, orderId);
    const target = input.targetStatus as CustomerDeliveryStatus;

    if (!canTransitionDeliveryStatus(order.deliveryStatus, target)) {
      throw new HttpError(409, "Delivery status transition is not allowed.", {
        code: "INVALID_DELIVERY_STATUS_TRANSITION",
        details: { current: order.deliveryStatus, target }
      });
    }

    if (isPaymongoPaymentPending(order) && target !== CustomerDeliveryStatus.CANCELLED) {
      throw new HttpError(
        409,
        "PayMongo payment must be confirmed before delivery processing starts.",
        {
          code: "PAYMONGO_PAYMENT_REQUIRED"
        }
      );
    }

    if (
      target === CustomerDeliveryStatus.CANCELLED &&
      order.paymentStatus === CustomerPaymentStatus.PAID
    ) {
      throw new HttpError(409, "Paid orders require a refund workflow before cancellation.", {
        code: "PAID_DELIVERY_CANNOT_CANCEL"
      });
    }

    const courierProvider = input.courierProvider?.trim() || order.courierProvider;
    if (target === CustomerDeliveryStatus.OUT_FOR_DELIVERY && !courierProvider) {
      throw new HttpError(400, "Choose the courier or delivery service before dispatch.", {
        code: "DELIVERY_COURIER_REQUIRED"
      });
    }

    const now = new Date();
    await tx.customerOrder.update({
      data: {
        courierProvider: courierProvider ?? null,
        courierReference: input.courierReference?.trim() || order.courierReference,
        deliveryNotes: input.note?.trim() || order.deliveryNotes,
        deliveryStatus: target,
        dispatchedAt: target === CustomerDeliveryStatus.OUT_FOR_DELIVERY ? now : order.dispatchedAt,
        status:
          target === CustomerDeliveryStatus.CANCELLED
            ? CustomerOrderStatus.CANCELLED
            : CustomerOrderStatus.PROCESSING
      },
      where: { id: order.id }
    });

    await tx.customerDeliveryEvent.create({
      data: {
        actorType: CustomerDeliveryActorType.STAFF,
        actorUserId,
        note: input.note?.trim() || null,
        orderId: order.id,
        status: target
      }
    });

    return serializeDeliveryOrder(await findDeliveryOrder(tx, order.id));
  });
}

export async function confirmCustomerDeliveryReceived(
  orderNumber: string,
  customerAccountId: string
) {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.customerOrder.findFirst({
      include: deliveryOrderInclude,
      where: { customerAccountId, orderNumber }
    });
    if (!order) {
      throw new HttpError(404, "Order was not found for this customer account.", {
        code: "CUSTOMER_DELIVERY_NOT_FOUND"
      });
    }

    if (order.deliveryStatus === CustomerDeliveryStatus.DELIVERED && order.customerConfirmedAt) {
      return { order: serializeDeliveryOrder(order), productIds: [] as string[] };
    }
    if (order.deliveryStatus !== CustomerDeliveryStatus.OUT_FOR_DELIVERY) {
      throw new HttpError(409, "This order is not currently out for delivery.", {
        code: "DELIVERY_NOT_OUT_FOR_DELIVERY"
      });
    }

    const now = new Date();
    await tx.customerOrder.update({
      data: {
        customerConfirmedAt: now,
        deliveredAt: now,
        deliveryStatus: CustomerDeliveryStatus.DELIVERED,
        status: CustomerOrderStatus.PROCESSING
      },
      where: { id: order.id }
    });
    await tx.customerDeliveryEvent.create({
      data: {
        actorCustomerAccountId: customerAccountId,
        actorType: CustomerDeliveryActorType.CUSTOMER,
        note: "Customer confirmed that the order was received.",
        orderId: order.id,
        status: CustomerDeliveryStatus.DELIVERED
      }
    });

    let productIds: string[] = [];
    if (
      order.paymentMethod === CustomerPaymentMethod.PAYMONGO &&
      order.paymentStatus === CustomerPaymentStatus.PAID
    ) {
      const refreshed = await findDeliveryOrder(tx, order.id);
      const finalized = await finalizeOrderSale(tx, refreshed);
      productIds = finalized.created ? finalized.productIds : [];
    }

    return {
      order: serializeDeliveryOrder(await findDeliveryOrder(tx, order.id)),
      productIds
    };
  });

  await invalidateProducts(result.productIds);
  return result.order;
}

export async function confirmCodCollected(
  orderId: string,
  actorUserId: string,
  input: CodSettlementInput
) {
  const result = await prisma.$transaction(async (tx) => {
    const order = await findDeliveryOrder(tx, orderId);
    if (order.paymentMethod !== CustomerPaymentMethod.CASH_ON_DELIVERY) {
      throw new HttpError(409, "This order is not a Cash on Delivery order.", {
        code: "ORDER_NOT_COD"
      });
    }
    if (!isCodSettlementReady(order)) {
      throw new HttpError(409, "COD can be settled only after the customer confirms receipt.", {
        code: "COD_NOT_READY_FOR_SETTLEMENT"
      });
    }
    if (order.paymentStatus === CustomerPaymentStatus.PAID && order.saleId) {
      return { order: serializeDeliveryOrder(order), productIds: [] as string[] };
    }

    const now = new Date();
    await tx.customerOrder.update({
      data: {
        codCollectedAt: now,
        codCollectedById: actorUserId,
        paidAt: order.paidAt ?? now,
        paymentStatus: CustomerPaymentStatus.PAID
      },
      where: { id: order.id }
    });
    await tx.customerDeliveryEvent.create({
      data: {
        actorType: CustomerDeliveryActorType.STAFF,
        actorUserId,
        note: input.note?.trim() || "COD payment collected and verified.",
        orderId: order.id,
        status: CustomerDeliveryStatus.DELIVERED
      }
    });

    const refreshed = await findDeliveryOrder(tx, order.id);
    const finalized = await finalizeOrderSale(tx, refreshed, actorUserId);
    return {
      order: serializeDeliveryOrder(await findDeliveryOrder(tx, order.id)),
      productIds: finalized.created ? finalized.productIds : []
    };
  });

  await invalidateProducts(result.productIds);
  return result.order;
}
