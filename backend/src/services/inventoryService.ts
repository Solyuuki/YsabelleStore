import { Prisma } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import { buildPaginationMeta, type PaginationMeta } from "../utils/pagination.js";
import type {
  InventoryListQuery,
  MovementHistoryQuery,
  StockAdjustRequest,
  StockDeductionRequest,
  StockInRequest
} from "../validators/inventory.validators.js";
import {
  serializeInventory,
  serializeMovement,
  serializePosLookup,
  type InventorySummaryRow,
  type MovementSummary,
  type PosLookupSummary,
  type ProductWithRelations
} from "./catalogSerializers.js";

type InventoryListResult = {
  items: InventorySummaryRow[];
  meta: PaginationMeta;
};

type MovementListResult = {
  items: MovementSummary[];
  meta: PaginationMeta;
};

type InventoryMutationResult = {
  inventory: InventorySummaryRow;
  movement: MovementSummary;
};

type DeductionLineItem = {
  productId: string;
  quantity: number;
};

type DeductionResult = {
  referenceType: string | null;
  referenceId: string | null;
  lineItems: Array<{
    productId: string;
    quantity: number;
    inventory: InventorySummaryRow;
    movement: MovementSummary;
  }>;
};

const inventoryInclude = {
  product: {
    include: {
      category: true
    }
  }
} as const;

const productLookupInclude = {
  category: true,
  inventory: true
} as const;

const movementInclude = {
  inventory: true,
  product: {
    include: {
      category: true
    }
  },
  performedBy: true
} as const;

function isKnownPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

function asInventorySummaryRow(
  inventory: Parameters<typeof serializeInventory>[0]
): InventorySummaryRow {
  return serializeInventory(inventory);
}

function asMovementSummary(movement: Parameters<typeof serializeMovement>[0]): MovementSummary {
  return serializeMovement(movement);
}

function asPosLookupSummary(product: ProductWithRelations): PosLookupSummary {
  return serializePosLookup(product);
}

function buildInventoryFilter(query: InventoryListQuery, categoryIds?: string[]) {
  const productFilters: Prisma.ProductWhereInput = {};

  if (query.productStatus) {
    productFilters.status = query.productStatus;
  }

  if (query.categoryId) {
    productFilters.categoryId = query.categoryId;
  }

  if (categoryIds !== undefined) {
    productFilters.categoryId = categoryIds.length > 0 ? { in: categoryIds } : { in: [] };
  }

  if (query.search) {
    productFilters.OR = [
      { name: { contains: query.search } },
      { sku: { contains: query.search } },
      { barcode: { contains: query.search } }
    ];
  }

  const where: Prisma.InventoryWhereInput = {};

  if (Object.keys(productFilters).length > 0) {
    where.product = productFilters;
  }

  return where;
}

function sortInventoryRows(items: InventorySummaryRow[], query: InventoryListQuery) {
  const direction = query.sortOrder === "asc" ? 1 : -1;

  const comparatorMap: Record<
    InventoryListQuery["sortBy"],
    (row: InventorySummaryRow) => string | number | Date | null
  > = {
    productName: (row) => row.productName,
    sku: (row) => row.sku,
    barcode: (row) => row.barcode ?? "",
    quantityOnHand: (row) => row.currentQuantity,
    reorderLevel: (row) => row.reorderLevel,
    lastStockUpdatedAt: (row) => row.lastStockUpdatedAt ?? new Date(0),
    createdAt: (row) => row.createdAt,
    updatedAt: (row) => row.updatedAt
  };

  const compareValue = comparatorMap[query.sortBy];

  return [...items].sort((left, right) => {
    const leftValue = compareValue(left);
    const rightValue = compareValue(right);

    if (leftValue instanceof Date && rightValue instanceof Date) {
      if (leftValue.getTime() === rightValue.getTime()) {
        return left.inventoryId.localeCompare(right.inventoryId);
      }

      return leftValue.getTime() > rightValue.getTime() ? direction : -direction;
    }

    if (typeof leftValue === "string" && typeof rightValue === "string") {
      const comparison = leftValue.localeCompare(rightValue);

      if (comparison === 0) {
        return left.inventoryId.localeCompare(right.inventoryId);
      }

      return comparison * direction;
    }

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      if (leftValue === rightValue) {
        return left.inventoryId.localeCompare(right.inventoryId);
      }

      return (leftValue - rightValue) * direction;
    }

    return left.inventoryId.localeCompare(right.inventoryId);
  });
}

function filterInventoryRows(items: InventorySummaryRow[], query: InventoryListQuery) {
  return items.filter((row) => {
    if (query.stockStatus !== "ALL") {
      if (query.stockStatus === "IN_STOCK" && row.stockStatus !== "IN_STOCK") {
        return false;
      }

      if (query.stockStatus === "LOW_STOCK" && row.stockStatus !== "LOW_STOCK") {
        return false;
      }

      if (query.stockStatus === "OUT_OF_STOCK" && row.stockStatus !== "OUT_OF_STOCK") {
        return false;
      }
    }

    return true;
  });
}

async function resolveCategoryIds(categoryId?: string, category?: string) {
  if (!categoryId && !category) {
    return undefined;
  }

  if (categoryId && category) {
    const match = await prisma.category.findFirst({
      where: {
        AND: [
          { id: categoryId },
          {
            OR: [{ name: category }, { slug: category }]
          }
        ]
      },
      select: {
        id: true
      }
    });

    return match ? [match.id] : [];
  }

  if (categoryId) {
    return [categoryId];
  }

  const categories = await prisma.category.findMany({
    where: {
      OR: [{ name: category }, { slug: category }]
    },
    select: {
      id: true
    }
  });

  return categories.map((entry) => entry.id);
}

async function getInventoryRecord(productId: string) {
  const inventory = await prisma.inventory.findUnique({
    include: inventoryInclude,
    where: {
      productId
    }
  });

  if (!inventory) {
    throw new HttpError(404, "Inventory record not found.", {
      code: "INVENTORY_NOT_FOUND"
    });
  }

  return inventory;
}

async function getOrCreateInventoryRecord(tx: Prisma.TransactionClient, productId: string) {
  const inventory = await tx.inventory.findUnique({
    include: inventoryInclude,
    where: {
      productId
    }
  });

  if (inventory) {
    return inventory;
  }

  return tx.inventory.create({
    data: {
      productId,
      quantityOnHand: 0,
      version: 0
    },
    include: inventoryInclude
  });
}

async function getProductForDeduction(tx: Prisma.TransactionClient, productId: string) {
  const product = await tx.product.findUnique({
    include: productLookupInclude,
    where: {
      id: productId
    }
  });

  if (!product) {
    throw new HttpError(404, "Product not found.", {
      code: "PRODUCT_NOT_FOUND"
    });
  }

  return product;
}

export async function listInventory(query: InventoryListQuery): Promise<InventoryListResult> {
  const categoryIds = await resolveCategoryIds(query.categoryId, query.category);

  if (categoryIds !== undefined && categoryIds.length === 0) {
    return {
      items: [],
      meta: buildPaginationMeta(0, {
        page: query.page,
        pageSize: query.pageSize
      })
    };
  }

  const where = buildInventoryFilter(query, categoryIds);
  const inventoryRows = await prisma.inventory.findMany({
    include: inventoryInclude,
    where
  });

  const normalizedRows = inventoryRows.map(asInventorySummaryRow);
  const filteredRows = filterInventoryRows(normalizedRows, query);
  const sortedRows = sortInventoryRows(filteredRows, query);
  const totalItems = sortedRows.length;
  const startIndex = (query.page - 1) * query.pageSize;
  const pageItems = sortedRows.slice(startIndex, startIndex + query.pageSize);

  return {
    items: pageItems,
    meta: buildPaginationMeta(totalItems, {
      page: query.page,
      pageSize: query.pageSize
    })
  };
}

export async function getInventoryByProductId(productId: string): Promise<InventorySummaryRow> {
  const inventory = await getInventoryRecord(productId);

  return asInventorySummaryRow(inventory);
}

export async function lookupInventoryByBarcode(barcode: string): Promise<PosLookupSummary> {
  const product = await prisma.product.findUnique({
    include: productLookupInclude,
    where: {
      barcode
    }
  });

  if (!product) {
    throw new HttpError(404, "Product not found.", {
      code: "PRODUCT_NOT_FOUND"
    });
  }

  return asPosLookupSummary(product);
}

export async function addStock(
  productId: string,
  input: StockInRequest,
  performedById?: string
): Promise<InventoryMutationResult> {
  const updatedAt = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const product = await getProductForDeduction(tx, productId);
      const inventory = await getOrCreateInventoryRecord(tx, product.id);
      const quantityBefore = inventory.quantityOnHand;
      const quantityAfter = quantityBefore + input.quantity;

      const updatedInventory = await tx.inventory.update({
        data: {
          quantityOnHand: quantityAfter,
          lastStockUpdatedAt: updatedAt,
          version: {
            increment: 1
          }
        },
        where: {
          id: inventory.id
        },
        include: inventoryInclude
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          inventoryId: updatedInventory.id,
          productId: product.id,
          type: "STOCK_IN",
          quantity: input.quantity,
          quantityBefore,
          quantityAfter,
          reason: input.reason,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          performedById
        },
        include: movementInclude
      });

      return {
        inventory: asInventorySummaryRow(updatedInventory),
        movement: asMovementSummary(movement)
      };
    });

    return result;
  } catch (error) {
    if (isKnownPrismaError(error) && error.code === "P2002") {
      throw new HttpError(409, "Stock update conflicted with an existing record.", {
        code: "INVENTORY_CONFLICT"
      });
    }

    throw error;
  }
}

export async function adjustStock(
  productId: string,
  input: StockAdjustRequest,
  performedById?: string
): Promise<InventoryMutationResult> {
  const updatedAt = new Date();

  return prisma.$transaction(async (tx) => {
    const product = await getProductForDeduction(tx, productId);
    const inventory = await getOrCreateInventoryRecord(tx, product.id);
    const quantityBefore = inventory.quantityOnHand;
    const quantityAfter =
      input.movementType === "ADJUSTMENT_IN"
        ? quantityBefore + input.quantity
        : quantityBefore - input.quantity;

    if (quantityAfter < 0) {
      throw new HttpError(409, "Stock adjustment cannot make inventory negative.", {
        code: "INSUFFICIENT_STOCK"
      });
    }

    const updatedInventory = await tx.inventory.update({
      data: {
        quantityOnHand: quantityAfter,
        lastStockUpdatedAt: updatedAt,
        version: {
          increment: 1
        }
      },
      where: {
        id: inventory.id
      },
      include: inventoryInclude
    });

    const movement = await tx.inventoryMovement.create({
      data: {
        inventoryId: updatedInventory.id,
        productId: product.id,
        type: input.movementType,
        quantity: input.quantity,
        quantityBefore,
        quantityAfter,
        reason: input.reason,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        performedById
      },
      include: movementInclude
    });

    return {
      inventory: asInventorySummaryRow(updatedInventory),
      movement: asMovementSummary(movement)
    };
  });
}

function mergeDeductionLineItems(lineItems: DeductionLineItem[]) {
  const merged = new Map<string, number>();

  for (const lineItem of lineItems) {
    merged.set(lineItem.productId, (merged.get(lineItem.productId) ?? 0) + lineItem.quantity);
  }

  return [...merged.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

export async function deductStock(
  input: StockDeductionRequest,
  performedById?: string
): Promise<DeductionResult> {
  const mergedLineItems = mergeDeductionLineItems(input.lineItems);
  const updatedAt = new Date();

  return prisma.$transaction(
    async (tx) => {
      const productIds = mergedLineItems.map((lineItem) => lineItem.productId);
      const products = await tx.product.findMany({
        include: productLookupInclude,
        where: {
          id: {
            in: productIds
          }
        }
      });

      if (products.length !== mergedLineItems.length) {
        const foundIds = new Set(products.map((product) => product.id));
        const missingIds = mergedLineItems
          .map((lineItem) => lineItem.productId)
          .filter((id) => !foundIds.has(id));

        throw new HttpError(404, "One or more products were not found.", {
          code: "PRODUCT_NOT_FOUND",
          details: {
            missingProductIds: missingIds
          }
        });
      }

      const productById = new Map(products.map((product) => [product.id, product]));
      const prepared: Array<{
        product: Awaited<ReturnType<typeof getProductForDeduction>>;
        inventory: Awaited<ReturnType<typeof getOrCreateInventoryRecord>>;
        quantityBefore: number;
        quantityAfter: number;
      }> = [];

      for (const lineItem of mergedLineItems) {
        const product = productById.get(lineItem.productId);

        if (!product) {
          throw new HttpError(404, "Product not found.", {
            code: "PRODUCT_NOT_FOUND",
            details: {
              productId: lineItem.productId
            }
          });
        }

        if (product.status !== "ACTIVE") {
          throw new HttpError(409, "Inactive products cannot be deducted from stock.", {
            code: "PRODUCT_INACTIVE",
            details: {
              productId: product.id,
              status: product.status
            }
          });
        }

        const inventory = await tx.inventory.findUnique({
          include: inventoryInclude,
          where: {
            productId: product.id
          }
        });

        const resolvedInventory = inventory ?? (await getOrCreateInventoryRecord(tx, product.id));
        const quantityBefore = resolvedInventory.quantityOnHand;
        const quantityAfter = quantityBefore - lineItem.quantity;

        if (quantityAfter < 0) {
          throw new HttpError(409, "Insufficient stock for one or more products.", {
            code: "INSUFFICIENT_STOCK",
            details: {
              productId: product.id,
              requested: lineItem.quantity,
              available: quantityBefore
            }
          });
        }

        prepared.push({
          product,
          inventory: resolvedInventory,
          quantityBefore,
          quantityAfter
        });
      }

      const lineResults = [];

      for (const entry of prepared) {
        const updatedInventory = await tx.inventory.update({
          data: {
            quantityOnHand: entry.quantityAfter,
            lastStockUpdatedAt: updatedAt,
            version: {
              increment: 1
            }
          },
          where: {
            id: entry.inventory.id
          },
          include: inventoryInclude
        });

        const movement = await tx.inventoryMovement.create({
          data: {
            inventoryId: updatedInventory.id,
            productId: entry.product.id,
            type: "SALE",
            quantity: entry.quantityBefore - entry.quantityAfter,
            quantityBefore: entry.quantityBefore,
            quantityAfter: entry.quantityAfter,
            reason: input.reason,
            referenceType: input.referenceType ?? "POS_CHECKOUT",
            referenceId: input.referenceId,
            performedById
          },
          include: movementInclude
        });

        lineResults.push({
          productId: entry.product.id,
          quantity: entry.quantityBefore - entry.quantityAfter,
          inventory: asInventorySummaryRow(updatedInventory),
          movement: asMovementSummary(movement)
        });
      }

      return {
        referenceType: input.referenceType ?? "POS_CHECKOUT",
        referenceId: input.referenceId ?? null,
        lineItems: lineResults
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    }
  );
}

export async function getMovementHistory(
  productId: string,
  query: MovementHistoryQuery
): Promise<MovementListResult> {
  const where: Prisma.InventoryMovementWhereInput = {
    productId
  };

  if (query.movementType) {
    where.type = query.movementType;
  }

  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {})
    };
  }

  const totalItems = await prisma.inventoryMovement.count({ where });
  const movements = await prisma.inventoryMovement.findMany({
    include: movementInclude,
    orderBy: [
      {
        createdAt: "desc"
      },
      {
        id: "desc"
      }
    ],
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
    where
  });

  return {
    items: movements.map(asMovementSummary),
    meta: buildPaginationMeta(totalItems, {
      page: query.page,
      pageSize: query.pageSize
    })
  };
}
