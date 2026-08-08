import { randomBytes } from "node:crypto";

import { CustomerOrderStatus, Prisma, ProductStatus } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import type {
  StorefrontOrderInput,
  StorefrontProductQuery
} from "../validators/storefront.validators.js";
import { getSellableStockQuantity } from "./stockDomainService.js";

const storefrontProductInclude = {
  category: true,
  inventoryBatches: true
} satisfies Prisma.ProductInclude;

type StorefrontProductRecord = Prisma.ProductGetPayload<{
  include: typeof storefrontProductInclude;
}>;

function stockStatus(availableStock: number, reorderLevel: number) {
  if (availableStock <= 0) return "OUT_OF_STOCK" as const;
  if (availableStock <= reorderLevel) return "LOW_STOCK" as const;
  return "IN_STOCK" as const;
}

function serializeStorefrontProduct(product: StorefrontProductRecord) {
  const availableStock = getSellableStockQuantity(product.inventoryBatches);

  return {
    id: product.id,
    name: product.name,
    description: product.description,
    unit: product.unit,
    sellingPrice: product.sellingPrice.toString(),
    availableStock,
    stockStatus: stockStatus(availableStock, product.reorderLevel),
    category: {
      id: product.category.id,
      name: product.category.name,
      slug: product.category.slug
    }
  };
}

export async function listStorefrontCategories() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    where: {
      isActive: true,
      products: { some: { status: ProductStatus.ACTIVE } }
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      _count: {
        select: { products: { where: { status: ProductStatus.ACTIVE } } }
      }
    }
  });

  return categories.map(({ _count, ...category }) => ({
    ...category,
    productCount: _count.products
  }));
}

export async function listStorefrontProducts(query: StorefrontProductQuery) {
  const search = query.search?.trim();
  const products = await prisma.product.findMany({
    include: storefrontProductInclude,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    where: {
      status: ProductStatus.ACTIVE,
      category: {
        isActive: true,
        ...(query.category ? { slug: query.category } : {})
      },
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { description: { contains: search } },
              { category: { name: { contains: search } } }
            ]
          }
        : {})
    }
  });

  const visibleProducts = products.map(serializeStorefrontProduct).filter((product) => {
    if (query.availability === "in-stock") return product.availableStock > 0;
    if (query.availability === "out-of-stock") return product.availableStock <= 0;
    return true;
  });
  const totalItems = visibleProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.pageSize;

  return {
    items: visibleProducts.slice(start, start + query.pageSize),
    meta: { page, pageSize: query.pageSize, totalItems, totalPages }
  };
}

export async function getStorefrontProduct(productId: string) {
  const product = await prisma.product.findFirst({
    include: storefrontProductInclude,
    where: {
      id: productId,
      status: ProductStatus.ACTIVE,
      category: { isActive: true }
    }
  });

  if (!product) {
    throw new HttpError(404, "Product was not found in the storefront.", {
      code: "STOREFRONT_PRODUCT_NOT_FOUND"
    });
  }

  return serializeStorefrontProduct(product);
}

export async function createStorefrontOrder(input: StorefrontOrderInput) {
  const itemQuantities = new Map<string, number>();
  for (const item of input.items) {
    itemQuantities.set(item.productId, (itemQuantities.get(item.productId) ?? 0) + item.quantity);
  }

  const normalizedItems = [...itemQuantities].map(([productId, quantity]) => ({
    productId,
    quantity
  }));

  return prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      include: storefrontProductInclude,
      where: {
        id: { in: normalizedItems.map((item) => item.productId) },
        status: ProductStatus.ACTIVE,
        category: { isActive: true }
      }
    });
    const productMap = new Map(products.map((product) => [product.id, product]));

    const orderItems = normalizedItems.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new HttpError(404, "One or more cart items are no longer available.", {
          code: "STOREFRONT_PRODUCT_NOT_FOUND",
          details: { productId: item.productId }
        });
      }

      const availableStock = getSellableStockQuantity(product.inventoryBatches);
      if (item.quantity > availableStock) {
        throw new HttpError(
          409,
          `Only ${availableStock} unit(s) of ${product.name} are available.`,
          {
            code: "INSUFFICIENT_STOCK",
            details: { available: availableStock, productId: product.id, requested: item.quantity }
          }
        );
      }

      const unitPrice = product.sellingPrice;
      return {
        product,
        quantity: item.quantity,
        unitPrice,
        totalAmount: unitPrice.mul(item.quantity)
      };
    });

    const subtotalAmount = orderItems.reduce(
      (sum, item) => sum.add(item.totalAmount),
      new Prisma.Decimal(0)
    );
    const order = await tx.customerOrder.create({
      data: {
        orderNumber: createOrderNumber(),
        customerName: input.customerName,
        customerEmail: input.customerEmail || null,
        customerPhone: input.customerPhone,
        fulfillmentMethod: input.fulfillmentMethod,
        paymentMethod: input.paymentMethod,
        notes: input.notes || null,
        status: CustomerOrderStatus.PENDING,
        subtotalAmount,
        totalAmount: subtotalAmount,
        items: {
          create: orderItems.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalAmount: item.totalAmount
          }))
        }
      },
      include: { items: { include: { product: true } } }
    });

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      fulfillmentMethod: order.fulfillmentMethod,
      paymentMethod: order.paymentMethod,
      totalAmount: order.totalAmount.toString(),
      createdAt: order.createdAt,
      itemCount: order.items.reduce((total, item) => total + item.quantity, 0),
      items: order.items.map((item) => ({
        productId: item.productId,
        productName: item.product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toString(),
        totalAmount: item.totalAmount.toString()
      }))
    };
  });
}

function createOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `YS-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
}
