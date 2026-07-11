import { randomBytes } from "node:crypto";

import { Prisma, SaleStatus } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import type { PosCheckoutItemInput } from "../validators/pos.validators.js";
import {
  allocateStockForSale,
  assertStockInvariant,
  createInventoryMovementAfterAllocation,
  synchronizeInventoryAggregate
} from "./stockDomainService.js";

type CheckoutCartItem = PosCheckoutItemInput;

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

type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
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
  cashReceived: string;
  discountAmount: string;
  change: string;
  id: string;
  itemCount: number;
  items: SaleItemRecord[];
  paymentMethod: "CASH";
  saleDate: string;
  saleNumber: string;
  status: SaleStatus;
  subtotalAmount: string;
  totalAmount: string;
};

type CheckoutResult = {
  sale: SaleSummaryRecord;
};

type SalesListResult = {
  sales: SaleSummaryRecord[];
};

function buildPosWhere(query: string) {
  const normalizedQuery = query.trim();

  return normalizedQuery
    ? {
        status: "ACTIVE" as const,
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
    : {
        status: "ACTIVE" as const
      };
}

export async function searchPosProducts(
  query: string,
  options: { page: number; pageSize: number }
): Promise<{
  catalogCount: number;
  products: PosProductResult[];
  query: string;
  meta: PaginationMeta;
}> {
  const normalizedQuery = query.trim();
  const where = buildPosWhere(normalizedQuery);
  const totalItems = await prisma.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalItems / options.pageSize));
  const page = Math.min(Math.max(options.page, 1), totalPages);

  const products = await prisma.product.findMany({
    include: {
      category: true,
      inventory: true
    },
    orderBy: [
      {
        updatedAt: "desc"
      },
      {
        id: "asc"
      }
    ],
    skip: (page - 1) * options.pageSize,
    take: options.pageSize,
    where
  });

  return {
    catalogCount: totalItems,
    query: normalizedQuery,
    products: products.map((product) => ({
      availableStock: product.inventory?.quantityOnHand ?? 0,
      barcode: product.barcode,
      categoryName: product.category.name,
      id: product.id,
      isActive: product.status === "ACTIVE",
      name: product.name,
      sku: product.sku,
      sellingPrice: product.sellingPrice.toString(),
      unit: product.unit
    })),
    meta: {
      page,
      pageSize: options.pageSize,
      totalItems,
      totalPages
    }
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
        inventory: true
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

      return {
        product,
        quantity: item.quantity,
        unitPrice
      };
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

      const quantityBefore = line.product.inventory.quantityOnHand;
      const allocations = await allocateStockForSale(tx, {
        productId: line.product.id,
        quantity: line.quantity
      });

      for (const allocation of allocations) {
        const lineTotal = line.unitPrice.mul(allocation.quantity);
        const createdSaleItem = await tx.saleItem.create({
          data: {
            batchId: allocation.batchId,
            productId: line.product.id,
            quantity: allocation.quantity,
            saleId: sale.id,
            totalAmount: lineTotal,
            unitPrice: line.unitPrice
          }
        });

        saleItems.push({
          batchId: allocation.batchId,
          barcode: line.product.barcode,
          id: createdSaleItem.id,
          productId: line.product.id,
          productName: line.product.name,
          quantity: allocation.quantity,
          sku: line.product.sku,
          totalAmount: lineTotal.toString(),
          unitPrice: line.unitPrice.toString()
        });
      }

      const syncResult = await synchronizeInventoryAggregate(tx, line.product.id);

      await createInventoryMovementAfterAllocation(tx, {
        batchId: allocations[0]?.batchId ?? null,
        inventoryId: line.product.inventory.id,
        performedById: input.cashierId,
        productId: line.product.id,
        quantity: line.quantity,
        quantityBefore,
        quantityAfter: syncResult.inventory.currentQuantity,
        reason: `POS sale ${sale.saleNumber}`,
        referenceId: sale.id,
        referenceType: "SALE",
        type: "SALE"
      });

      await assertStockInvariant(tx, line.product.id);
    }

    return {
      sale: {
        cashierName: input.cashierName,
        cashReceived: totalAmount.toString(),
        discountAmount: sale.discountAmount.toString(),
        change: new Prisma.Decimal(0).toString(),
        id: sale.id,
        itemCount: saleItems.reduce((sum, item) => sum + item.quantity, 0),
        items: saleItems,
        paymentMethod: "CASH",
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
      cashReceived: sale.totalAmount.toString(),
      discountAmount: sale.discountAmount.toString(),
      change: new Prisma.Decimal(0).toString(),
      id: sale.id,
      itemCount: sale.items.reduce((sum, item) => sum + item.quantity, 0),
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
      paymentMethod: "CASH",
      saleDate: sale.saleDate.toISOString(),
      saleNumber: sale.saleNumber,
      status: sale.status,
      subtotalAmount: sale.subtotalAmount.toString(),
      totalAmount: sale.totalAmount.toString()
    }))
  };
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

function generateSaleNumber(date: Date) {
  const timestamp = date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "");
  const suffix = randomBytes(2).toString("hex").toUpperCase();

  return `SL-${timestamp}-${suffix}`;
}

function toDecimal(value: Prisma.Decimal | number | string) {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}
