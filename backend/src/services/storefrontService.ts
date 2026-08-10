import { randomBytes } from "node:crypto";

import { CustomerOrderStatus, Prisma, SaleStatus } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { getEffectiveMonthlySeries } from "../modules/forecasting/effective-sales.service.js";
import { HttpError } from "../utils/httpError.js";
import type {
  StorefrontOrderInput,
  StorefrontProductQuery
} from "../validators/storefront.validators.js";
import {
  approvedStorefrontCategoryWhere,
  approvedStorefrontProductCoreWhere,
  storefrontProductWhere
} from "./catalogQualityPolicy.js";
import { getSellableStockQuantity } from "./stockDomainService.js";

const storefrontProductInclude = {
  category: true,
  inventoryBatches: true
} satisfies Prisma.ProductInclude;

type StorefrontProductRecord = Prisma.ProductGetPayload<{
  include: typeof storefrontProductInclude;
}>;

const STOREFRONT_MERCHANDISING_LIMIT = 4;
const TRENDING_WINDOW_DAYS = 30;

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
    imageUrl: product.imageUrl,
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
      AND: [
        approvedStorefrontCategoryWhere,
        { products: { some: approvedStorefrontProductCoreWhere } }
      ]
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      products: {
        orderBy: [{ name: "asc" }, { id: "asc" }],
        select: { id: true, imageUrl: true, name: true },
        take: 3,
        where: { AND: [approvedStorefrontProductCoreWhere, { imageUrl: { not: null } }] }
      },
      _count: {
        select: { products: { where: approvedStorefrontProductCoreWhere } }
      }
    }
  });

  return categories.map(({ _count, products, ...category }) => ({
    ...category,
    productCount: _count.products,
    representativeProducts: products.filter(
      (product): product is typeof product & { imageUrl: string } => Boolean(product.imageUrl)
    )
  }));
}

export async function listStorefrontProducts(query: StorefrontProductQuery) {
  const search = query.search?.trim();
  const products = await prisma.product.findMany({
    include: storefrontProductInclude,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    where: storefrontProductWhere({
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { description: { contains: search } },
              { category: { name: { contains: search } } }
            ]
          }
        : {})
    })
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

export async function listStorefrontMerchandising(now = new Date()) {
  const products = await prisma.product.findMany({
    include: storefrontProductInclude,
    where: storefrontProductWhere()
  });
  const availableProducts = products
    .map(serializeStorefrontProduct)
    .filter((product) => product.availableStock > 0);
  const productIds = availableProducts.map((product) => product.id);

  if (productIds.length === 0) {
    return {
      bestSellers: [],
      generatedAt: now.toISOString(),
      trending: [],
      trendingWindowDays: TRENDING_WINDOW_DAYS
    };
  }

  const trendingWindowStart = new Date(now.getTime() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [effectiveSeries, recentSaleItems] = await Promise.all([
    getEffectiveMonthlySeries(productIds),
    prisma.saleItem.findMany({
      select: { productId: true, quantity: true },
      where: {
        productId: { in: productIds },
        sale: {
          saleDate: { gte: trendingWindowStart, lte: now },
          status: SaleStatus.COMPLETED
        }
      }
    })
  ]);
  const recentUnits = sumUnitsByProduct(recentSaleItems);
  const historicalUnits = new Map(
    effectiveSeries.map((series) => [
      series.productId,
      series.points.reduce((total, point) => total + point.quantitySold, 0)
    ])
  );

  return {
    bestSellers: rankStorefrontProducts(availableProducts, historicalUnits),
    generatedAt: now.toISOString(),
    trending: rankStorefrontProducts(availableProducts, recentUnits),
    trendingWindowDays: TRENDING_WINDOW_DAYS
  };
}

export async function getStorefrontProduct(productId: string) {
  const product = await prisma.product.findFirst({
    include: storefrontProductInclude,
    where: storefrontProductWhere({ id: productId })
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
      where: storefrontProductWhere({
        id: { in: normalizedItems.map((item) => item.productId) }
      })
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

function sumUnitsByProduct(items: Array<{ productId: string; quantity: number }>) {
  const totals = new Map<string, number>();

  for (const item of items) {
    totals.set(item.productId, (totals.get(item.productId) ?? 0) + item.quantity);
  }

  return totals;
}

function rankStorefrontProducts(
  products: ReturnType<typeof serializeStorefrontProduct>[],
  unitsByProduct: Map<string, number>
) {
  return products
    .map((product) => ({ product, unitsSold: unitsByProduct.get(product.id) ?? 0 }))
    .filter((entry) => entry.unitsSold > 0)
    .sort(
      (left, right) =>
        right.unitsSold - left.unitsSold ||
        left.product.name.localeCompare(right.product.name) ||
        left.product.id.localeCompare(right.product.id)
    )
    .slice(0, STOREFRONT_MERCHANDISING_LIMIT)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}
