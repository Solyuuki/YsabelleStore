import { randomBytes } from "node:crypto";

import { InventoryBatchStatus, InventoryMovementType, Prisma, SaleStatus } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import type { PosCheckoutItemInput } from "../validators/pos.validators.js";

type CheckoutCartItem = PosCheckoutItemInput;

type PosProductRecord = {
  barcode: string | null;
  category: {
    name: string;
  };
  inventory: {
    id: string;
    quantityOnHand: number;
  } | null;
  id: string;
  inventoryBatches: Array<{
    createdAt: Date;
    expiresAt: Date | null;
    id: string;
    quantityRemaining: number;
    status: InventoryBatchStatus;
  }>;
  name: string;
  reorderLevel: number;
  sku: string;
  status: "ACTIVE" | "INACTIVE" | "DISCONTINUED";
  sellingPrice: Prisma.Decimal;
};

type BatchAllocation = {
  batch: {
    id: string;
    quantityRemaining: number;
  };
  quantity: number;
};

type CheckoutLine = {
  allocations: BatchAllocation[];
  availableStock: number;
  product: PosProductRecord;
  quantity: number;
  unitPrice: Prisma.Decimal;
};

type SaleItemRecord = {
  batchId: string | null;
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  sku: string;
  barcode: string | null;
  totalAmount: string;
  unitPrice: string;
};

type SaleSummaryRecord = {
  cashierName: string | null;
  discountAmount: string;
  id: string;
  itemCount: number;
  items: SaleItemRecord[];
  saleDate: string;
  saleNumber: string;
  status: SaleStatus;
  subtotalAmount: string;
  totalAmount: string;
};

type PosProductResult = {
  availableStock: number;
  barcode: string | null;
  categoryName: string;
  id: string;
  isActive: boolean;
  name: string;
  sku: string;
  sellingPrice: string;
  unit: string;
};

type CheckoutResult = {
  sale: SaleSummaryRecord;
};

type SalesListResult = {
  sales: SaleSummaryRecord[];
};

const PRODUCT_SEARCH_LIMIT = 20;

export async function searchPosProducts(query: string): Promise<{
  catalogCount: number;
  products: PosProductResult[];
  query: string;
}> {
  const normalizedQuery = query.trim();

  const catalogCount = await prisma.product.count({
    where: {
      status: "ACTIVE"
    }
  });

  const products = normalizedQuery
    ? await prisma.product.findMany({
        include: {
          category: true,
          inventory: true,
          inventoryBatches: {
            select: {
              createdAt: true,
              expiresAt: true,
              id: true,
              quantityRemaining: true,
              status: true
            }
          }
        },
        orderBy: {
          updatedAt: "desc"
        },
        take: PRODUCT_SEARCH_LIMIT,
        where: {
          status: "ACTIVE",
          OR: [
            { name: { contains: normalizedQuery } },
            { sku: { contains: normalizedQuery } },
            { barcode: { contains: normalizedQuery } },
            { description: { contains: normalizedQuery } },
            {
              category: {
                name: {
                  contains: normalizedQuery
                }
              }
            }
          ]
        }
      })
    : [];

  return {
    catalogCount,
    query: normalizedQuery,
    products: products.map((product) => ({
      availableStock: getAvailableStock(product.inventoryBatches),
      barcode: product.barcode,
      categoryName: product.category.name,
      id: product.id,
      isActive: product.status === "ACTIVE",
      name: product.name,
      sku: product.sku,
      sellingPrice: product.sellingPrice.toString(),
      unit: product.unit
    }))
  };
}

export async function checkoutPosSale(input: {
  cashierId: string;
  cashierName: string;
  notes?: string | null;
  items: CheckoutCartItem[];
}): Promise<CheckoutResult> {
  const normalizedItems = mergeCartItems(input.items);

  if (normalizedItems.length === 0) {
    throw new HttpError(400, "Checkout requires at least one item.", {
      code: "EMPTY_CHECKOUT_CART"
    });
  }

  const saleDate = new Date();
  const saleNumber = generateSaleNumber(saleDate);

  return prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      include: {
        category: true,
        inventory: true,
        inventoryBatches: {
          orderBy: [
            {
              expiresAt: "asc"
            },
            {
              createdAt: "asc"
            }
          ],
          select: {
            createdAt: true,
            expiresAt: true,
            id: true,
            quantityRemaining: true,
            status: true,
            unitCost: true
          }
        }
      },
      where: {
        id: {
          in: normalizedItems.map((item) => item.productId)
        },
        status: "ACTIVE"
      }
    });

    const productMap = new Map(products.map((product) => [product.id, product]));
    const checkoutLines = normalizedItems.map((item) => {
      const product = productMap.get(item.productId);

      if (!product) {
        throw new HttpError(404, "One or more products could not be found.", {
          code: "POS_PRODUCT_NOT_FOUND",
          details: {
            productId: item.productId
          }
        });
      }

      const unitPrice = toDecimal(product.sellingPrice);

      if (unitPrice.lessThan(0)) {
        throw new HttpError(422, "One or more products have an invalid price.", {
          code: "INVALID_PRODUCT_PRICE",
          details: {
            productId: product.id
          }
        });
      }

      const availableStock = getAvailableStock(product.inventoryBatches);

      if (item.quantity > availableStock) {
        throw new HttpError(409, "Insufficient stock for checkout.", {
          code: "INSUFFICIENT_STOCK",
          details: {
            availableStock,
            productId: product.id,
            requestedQuantity: item.quantity
          }
        });
      }

      return {
        allocations: allocateFromBatches(product.inventoryBatches, item.quantity),
        availableStock,
        product,
        quantity: item.quantity,
        unitPrice
      } satisfies CheckoutLine;
    });

    const subtotalAmount = checkoutLines.reduce(
      (sum, line) => sum.add(line.unitPrice.mul(line.quantity)),
      new Prisma.Decimal(0)
    );
    const discountAmount = new Prisma.Decimal(0);
    const totalAmount = subtotalAmount.sub(discountAmount);

    const sale = await tx.sale.create({
      data: {
        cashierId: input.cashierId,
        discountAmount,
        notes: input.notes?.trim() || null,
        saleDate,
        saleNumber,
        status: SaleStatus.COMPLETED,
        subtotalAmount,
        totalAmount
      }
    });

    const saleItems: SaleItemRecord[] = [];

    for (const line of checkoutLines) {
      if (!line.product.inventory) {
        throw new HttpError(404, "Inventory record was not found for the selected product.", {
          code: "INVENTORY_NOT_FOUND",
          details: {
            productId: line.product.id
          }
        });
      }

      for (const allocation of line.allocations) {
        const lineTotal = line.unitPrice.mul(allocation.quantity);
        const quantityBefore = line.product.inventory.quantityOnHand;
        const quantityAfter = quantityBefore - allocation.quantity;
        const createdSaleItem = await tx.saleItem.create({
          data: {
            batchId: allocation.batch.id,
            productId: line.product.id,
            quantity: allocation.quantity,
            saleId: sale.id,
            totalAmount: lineTotal,
            unitPrice: line.unitPrice
          }
        });

        saleItems.push({
          batchId: allocation.batch.id,
          barcode: line.product.barcode,
          id: createdSaleItem.id,
          productId: line.product.id,
          productName: line.product.name,
          quantity: allocation.quantity,
          sku: line.product.sku,
          totalAmount: lineTotal.toString(),
          unitPrice: line.unitPrice.toString()
        });

        const remainingQuantity = allocation.batch.quantityRemaining - allocation.quantity;
        const nextStatus =
          remainingQuantity <= 0
            ? InventoryBatchStatus.DEPLETED
            : line.product.reorderLevel > 0 && remainingQuantity <= line.product.reorderLevel
              ? InventoryBatchStatus.LOW_STOCK
              : InventoryBatchStatus.AVAILABLE;

        await tx.inventoryBatch.update({
          data: {
            quantityRemaining: remainingQuantity,
            status: nextStatus
          },
          where: {
            id: allocation.batch.id
          }
        });

        await tx.inventory.update({
          data: {
            lastStockUpdatedAt: saleDate,
            quantityOnHand: quantityAfter,
            version: {
              increment: 1
            }
          },
          where: {
            id: line.product.inventory.id
          }
        });

        await tx.inventoryMovement.create({
          data: {
            inventoryId: line.product.inventory.id,
            batchId: allocation.batch.id,
            quantityAfter,
            quantityBefore,
            performedById: input.cashierId,
            productId: line.product.id,
            quantity: allocation.quantity,
            reason: `POS sale ${sale.saleNumber}`,
            referenceId: sale.id,
            referenceType: "SALE",
            type: InventoryMovementType.SALE
          }
        });

        line.product.inventory.quantityOnHand = quantityAfter;
      }
    }

    return {
      sale: {
        cashierName: input.cashierName,
        discountAmount: sale.discountAmount.toString(),
        id: sale.id,
        itemCount: saleItems.length,
        items: saleItems,
        saleDate: sale.saleDate.toISOString(),
        saleNumber: sale.saleNumber,
        status: sale.status,
        subtotalAmount: sale.subtotalAmount.toString(),
        totalAmount: sale.totalAmount.toString()
      }
    };
  });
}

export async function listRecentSales(limit = 20): Promise<SalesListResult> {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const sales = await prisma.sale.findMany({
    include: {
      cashier: true,
      items: {
        include: {
          product: true
        },
        orderBy: {
          createdAt: "asc"
        }
      }
    },
    orderBy: {
      saleDate: "desc"
    },
    take: safeLimit
  });

  return {
    sales: sales.map((sale) => ({
      cashierName: sale.cashier?.name ?? null,
      discountAmount: sale.discountAmount.toString(),
      id: sale.id,
      itemCount: sale.items.length,
      items: sale.items.map((item) => ({
        batchId: item.batchId,
        barcode: item.product.barcode,
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        quantity: item.quantity,
        sku: item.product.sku,
        totalAmount: item.totalAmount.toString(),
        unitPrice: item.unitPrice.toString()
      })),
      saleDate: sale.saleDate.toISOString(),
      saleNumber: sale.saleNumber,
      status: sale.status,
      subtotalAmount: sale.subtotalAmount.toString(),
      totalAmount: sale.totalAmount.toString()
    }))
  };
}

function allocateFromBatches(
  batches: Array<{ id: string; quantityRemaining: number }>,
  quantity: number
) {
  let remainingQuantity = quantity;
  const allocations: BatchAllocation[] = [];

  for (const batch of batches) {
    if (remainingQuantity <= 0) {
      break;
    }

    if (batch.quantityRemaining <= 0) {
      continue;
    }

    const allocatedQuantity = Math.min(batch.quantityRemaining, remainingQuantity);

    allocations.push({
      batch,
      quantity: allocatedQuantity
    });

    remainingQuantity -= allocatedQuantity;
  }

  return allocations;
}

function generateSaleNumber(date: Date) {
  const timestamp = date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "");
  const suffix = randomBytes(2).toString("hex").toUpperCase();

  return `SL-${timestamp}-${suffix}`;
}

function getAvailableStock(
  batches: Array<{
    quantityRemaining: number;
    status: InventoryBatchStatus;
  }>
) {
  return batches.reduce((total, batch) => {
    if (
      batch.status === InventoryBatchStatus.REMOVED ||
      batch.status === InventoryBatchStatus.EXPIRED
    ) {
      return total;
    }

    return total + batch.quantityRemaining;
  }, 0);
}

function mergeCartItems(items: CheckoutCartItem[]) {
  const itemMap = new Map<string, number>();

  for (const item of items) {
    itemMap.set(item.productId, (itemMap.get(item.productId) ?? 0) + item.quantity);
  }

  return [...itemMap.entries()].map(([productId, quantity]) => ({
    productId,
    quantity
  }));
}

function toDecimal(value: Prisma.Decimal | number | string) {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}
