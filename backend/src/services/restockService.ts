import { randomBytes } from "node:crypto";

import { Prisma, RestockOrderStatus } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import { buildPaginationMeta } from "../utils/pagination.js";
import type {
  ApproveRestockOrderRequest,
  CreateRestockOrderRequest,
  ReplaceRestockOrderLinesRequest,
  RestockOrderListQuery,
  UpdateRestockOrderRequest
} from "../validators/restock.validators.js";

const restockOrderInclude = {
  approvedBy: {
    select: {
      id: true,
      name: true
    }
  },
  createdBy: {
    select: {
      id: true,
      name: true
    }
  },
  lines: {
    include: {
      product: {
        select: {
          barcode: true,
          id: true,
          name: true,
          reorderLevel: true,
          sku: true,
          status: true,
          targetStockLevel: true
        }
      },
      recommendation: {
        select: {
          id: true,
          reason: true,
          status: true,
          type: true
        }
      }
    },
    orderBy: [{ isSelected: "desc" }, { createdAt: "asc" }]
  }
} satisfies Prisma.RestockOrderInclude;

type RestockTransaction = Prisma.TransactionClient;
type DraftLine = CreateRestockOrderRequest["lines"][number];

function isKnownPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

function generateRestockOrderNumber(date = new Date()) {
  const timestamp = date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "");
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `RO-${timestamp}-${suffix}`;
}

async function assertRestockLineReferences(tx: RestockTransaction, lines: DraftLine[]) {
  const productIds = lines.map((line) => line.productId);
  const products = await tx.product.findMany({
    select: {
      dataQualityStatus: true,
      id: true,
      recordSource: true,
      status: true
    },
    where: {
      id: { in: productIds }
    }
  });
  const productById = new Map(products.map((product) => [product.id, product]));

  for (const line of lines) {
    const product = productById.get(line.productId);
    if (!product) {
      throw new HttpError(404, "One or more restock products were not found.", {
        code: "RESTOCK_PRODUCT_NOT_FOUND",
        details: { productId: line.productId }
      });
    }

    if (
      product.status === "DISCONTINUED" ||
      product.recordSource === "TEST_FIXTURE" ||
      product.dataQualityStatus === "REJECTED"
    ) {
      throw new HttpError(422, "The selected product is not eligible for restocking.", {
        code: "RESTOCK_PRODUCT_INELIGIBLE",
        details: { productId: line.productId }
      });
    }
  }

  const recommendationIds = lines
    .map((line) => line.recommendationId)
    .filter((id): id is string => Boolean(id));

  if (recommendationIds.length === 0) return;

  const recommendations = await tx.recommendationRecord.findMany({
    select: {
      id: true,
      productId: true,
      status: true,
      type: true
    },
    where: {
      id: { in: recommendationIds }
    }
  });
  const recommendationById = new Map(
    recommendations.map((recommendation) => [recommendation.id, recommendation])
  );

  for (const line of lines) {
    if (!line.recommendationId) continue;
    const recommendation = recommendationById.get(line.recommendationId);

    if (!recommendation || recommendation.productId !== line.productId) {
      throw new HttpError(422, "The selected recommendation does not belong to this product.", {
        code: "RESTOCK_RECOMMENDATION_MISMATCH",
        details: {
          productId: line.productId,
          recommendationId: line.recommendationId
        }
      });
    }

    if (
      !["RESTOCK", "LOW_STOCK"].includes(recommendation.type) ||
      recommendation.status === "RESOLVED" ||
      recommendation.status === "DISMISSED"
    ) {
      throw new HttpError(422, "The selected recommendation is not available for restocking.", {
        code: "RESTOCK_RECOMMENDATION_INELIGIBLE",
        details: { recommendationId: line.recommendationId }
      });
    }
  }
}

function lineCreateData(orderId: string, line: DraftLine) {
  return {
    isSelected: line.isSelected,
    notes: line.notes ?? null,
    order: { connect: { id: orderId } },
    ownerOverrideReason: line.ownerOverrideReason ?? null,
    product: { connect: { id: line.productId } },
    recommendation: line.recommendationId ? { connect: { id: line.recommendationId } } : undefined,
    recommendationSource: line.recommendationSource,
    recommendedQuantity: line.recommendedQuantity,
    requestedQuantity: line.requestedQuantity,
    receivedQuantity: 0
  } satisfies Prisma.RestockOrderLineCreateInput;
}

async function loadRestockOrder(orderId: string) {
  const order = await prisma.restockOrder.findUnique({
    include: restockOrderInclude,
    where: { id: orderId }
  });

  if (!order) {
    throw new HttpError(404, "Restock order was not found.", {
      code: "RESTOCK_ORDER_NOT_FOUND"
    });
  }

  return order;
}

function assertDraft(
  order: { id: string; status: RestockOrderStatus; version: number },
  expectedVersion: number
) {
  if (order.status !== RestockOrderStatus.DRAFT) {
    throw new HttpError(409, "Only draft restock orders can be edited.", {
      code: "RESTOCK_ORDER_NOT_DRAFT",
      details: { orderId: order.id, status: order.status }
    });
  }

  if (order.version !== expectedVersion) {
    throw new HttpError(409, "The restock order changed elsewhere. Refresh and try again.", {
      code: "RESTOCK_ORDER_VERSION_CONFLICT",
      details: {
        currentVersion: order.version,
        expectedVersion,
        orderId: order.id
      }
    });
  }
}

export async function createRestockOrder(input: CreateRestockOrderRequest, createdById: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const orderId = await prisma.$transaction(async (tx) => {
        await assertRestockLineReferences(tx, input.lines);
        const order = await tx.restockOrder.create({
          data: {
            createdById,
            notes: input.notes ?? null,
            orderNumber: generateRestockOrderNumber(),
            status: RestockOrderStatus.DRAFT
          },
          select: { id: true }
        });

        for (const line of input.lines) {
          await tx.restockOrderLine.create({
            data: lineCreateData(order.id, line)
          });
        }

        return order.id;
      });

      return await loadRestockOrder(orderId);
    } catch (error) {
      if (isKnownPrismaError(error) && error.code === "P2002" && attempt < 2) {
        continue;
      }
      throw error;
    }
  }

  throw new HttpError(409, "A unique restock order number could not be allocated.", {
    code: "RESTOCK_ORDER_NUMBER_CONFLICT"
  });
}

export async function listRestockOrders(query: RestockOrderListQuery) {
  const statuses = query.status ? [query.status] : query.statuses;
  const where: Prisma.RestockOrderWhereInput = {
    ...(statuses?.length ? { status: statuses.length === 1 ? statuses[0] : { in: statuses } } : {}),
    ...(query.search ? { orderNumber: { contains: query.search } } : {}),
    ...(query.hasReturns
      ? {
          OR: [
            { notes: { contains: "[ReturnReport " } },
            { lines: { some: { notes: { contains: "damage_reason=" } } } }
          ]
        }
      : {})
  };
  const [totalItems, orders] = await prisma.$transaction([
    prisma.restockOrder.count({ where }),
    prisma.restockOrder.findMany({
      include: restockOrderInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      where
    })
  ]);

  return {
    items: orders,
    meta: buildPaginationMeta(totalItems, {
      page: query.page,
      pageSize: query.pageSize
    })
  };
}

export async function getRestockOrder(orderId: string) {
  return await loadRestockOrder(orderId);
}

export async function updateRestockOrder(orderId: string, input: UpdateRestockOrderRequest) {
  const existing = await prisma.restockOrder.findUnique({
    select: { id: true, status: true, version: true },
    where: { id: orderId }
  });

  if (!existing) {
    throw new HttpError(404, "Restock order was not found.", {
      code: "RESTOCK_ORDER_NOT_FOUND"
    });
  }
  assertDraft(existing, input.expectedVersion);

  const updated = await prisma.restockOrder.updateMany({
    data: {
      notes: input.notes ?? null,
      version: { increment: 1 }
    },
    where: {
      id: orderId,
      status: RestockOrderStatus.DRAFT,
      version: input.expectedVersion
    }
  });

  if (updated.count !== 1) {
    throw new HttpError(409, "The restock order changed elsewhere. Refresh and try again.", {
      code: "RESTOCK_ORDER_VERSION_CONFLICT"
    });
  }

  return await loadRestockOrder(orderId);
}

export async function replaceRestockOrderLines(
  orderId: string,
  input: ReplaceRestockOrderLinesRequest
) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.restockOrder.findUnique({
      select: { id: true, status: true, version: true },
      where: { id: orderId }
    });

    if (!existing) {
      throw new HttpError(404, "Restock order was not found.", {
        code: "RESTOCK_ORDER_NOT_FOUND"
      });
    }
    assertDraft(existing, input.expectedVersion);
    await assertRestockLineReferences(tx, input.lines);

    const versionUpdate = await tx.restockOrder.updateMany({
      data: { version: { increment: 1 } },
      where: {
        id: orderId,
        status: RestockOrderStatus.DRAFT,
        version: input.expectedVersion
      }
    });

    if (versionUpdate.count !== 1) {
      throw new HttpError(409, "The restock order changed elsewhere. Refresh and try again.", {
        code: "RESTOCK_ORDER_VERSION_CONFLICT"
      });
    }

    await tx.restockOrderLine.deleteMany({ where: { restockOrderId: orderId } });
    for (const line of input.lines) {
      await tx.restockOrderLine.create({ data: lineCreateData(orderId, line) });
    }
  });

  return await loadRestockOrder(orderId);
}

export async function approveRestockOrder(
  orderId: string,
  input: ApproveRestockOrderRequest,
  approvedById: string
) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.restockOrder.findUnique({
      include: {
        lines: {
          select: {
            isSelected: true,
            recommendationId: true,
            requestedQuantity: true
          }
        }
      },
      where: { id: orderId }
    });

    if (!existing) {
      throw new HttpError(404, "Restock order was not found.", {
        code: "RESTOCK_ORDER_NOT_FOUND"
      });
    }
    assertDraft(existing, input.expectedVersion);

    const selectedLines = existing.lines.filter((line) => line.isSelected);
    if (selectedLines.length === 0) {
      throw new HttpError(422, "Select at least one restock line before approval.", {
        code: "RESTOCK_APPROVAL_EMPTY"
      });
    }
    if (selectedLines.some((line) => line.requestedQuantity < 1)) {
      throw new HttpError(422, "Selected restock lines require a positive requested quantity.", {
        code: "RESTOCK_APPROVAL_INVALID_QUANTITY"
      });
    }

    const updated = await tx.restockOrder.updateMany({
      data: {
        approvedAt: new Date(),
        approvedById,
        status: RestockOrderStatus.APPROVED,
        version: { increment: 1 }
      },
      where: {
        id: orderId,
        status: RestockOrderStatus.DRAFT,
        version: input.expectedVersion
      }
    });

    if (updated.count !== 1) {
      throw new HttpError(409, "The restock order changed elsewhere. Refresh and try again.", {
        code: "RESTOCK_ORDER_VERSION_CONFLICT"
      });
    }

    const recommendationIds = selectedLines
      .map((line) => line.recommendationId)
      .filter((id): id is string => Boolean(id));
    if (recommendationIds.length > 0) {
      await tx.recommendationRecord.updateMany({
        data: { status: "ACKNOWLEDGED" },
        where: {
          id: { in: recommendationIds },
          status: "OPEN"
        }
      });
    }
  });

  return await loadRestockOrder(orderId);
}

export async function getIncomingRestockStock(productIds?: string[]) {
  const lines = await prisma.restockOrderLine.findMany({
    select: {
      productId: true,
      receivedQuantity: true,
      requestedQuantity: true
    },
    where: {
      isSelected: true,
      ...(productIds?.length ? { productId: { in: [...new Set(productIds)] } } : {}),
      order: {
        status: {
          in: [
            RestockOrderStatus.APPROVED,
            RestockOrderStatus.AWAITING_DELIVERY,
            RestockOrderStatus.PARTIALLY_RECEIVED
          ]
        }
      }
    }
  });
  const incomingByProduct = new Map<string, number>();

  for (const line of lines) {
    const incoming = Math.max(0, line.requestedQuantity - line.receivedQuantity);
    incomingByProduct.set(line.productId, (incomingByProduct.get(line.productId) ?? 0) + incoming);
  }

  return incomingByProduct;
}
