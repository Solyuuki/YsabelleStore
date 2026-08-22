import { randomBytes } from "node:crypto";

import { CustomerOrderStatus, InventoryBatchStatus, Prisma, SaleStatus } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { getEffectiveMonthlySeries } from "../modules/forecasting/effective-sales.service.js";
import { HttpError } from "../utils/httpError.js";
import type {
  StorefrontOrderInput,
  StorefrontProductReviewQuery,
  StorefrontProductQuery
} from "../validators/storefront.validators.js";
import {
  approvedStorefrontCategoryWhere,
  storefrontProductWhere,
  temporaryImageReadyStorefrontProductWhere
} from "./catalogQualityPolicy.js";
import { getSellableStockQuantity } from "./stockDomainService.js";

const storefrontProductInclude = {
  category: true,
  inventoryBatches: true
} satisfies Prisma.ProductInclude;

const storefrontOrderInclude = {
  items: { include: { product: true } }
} satisfies Prisma.CustomerOrderInclude;

type StorefrontProductRecord = Prisma.ProductGetPayload<{
  include: typeof storefrontProductInclude;
}>;

type StorefrontOrderRecord = Prisma.CustomerOrderGetPayload<{
  include: typeof storefrontOrderInclude;
}>;

type StorefrontProductReviewSummary = {
  averageRating: number;
  reviewCount: number;
};

type StorefrontOrderContext = {
  customerAccountId?: string;
};

const STOREFRONT_MERCHANDISING_LIMIT = 4;
const STOREFRONT_RELATED_CANDIDATE_MULTIPLIER = 3;
const TRENDING_WINDOW_DAYS = 30;

function stockStatus(availableStock: number, reorderLevel: number) {
  if (availableStock <= 0) return "OUT_OF_STOCK" as const;
  if (availableStock <= reorderLevel) return "LOW_STOCK" as const;
  return "IN_STOCK" as const;
}

function serializeStorefrontProduct(
  product: StorefrontProductRecord,
  reviewSummary: StorefrontProductReviewSummary
) {
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
    averageRating: reviewSummary.averageRating,
    reviewCount: reviewSummary.reviewCount,
    category: {
      id: product.category.id,
      name: product.category.name,
      slug: product.category.slug
    }
  };
}

function serializeStorefrontOrder(order: StorefrontOrderRecord) {
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
}

async function serializeStorefrontProducts(products: StorefrontProductRecord[]) {
  if (products.length === 0) return [];

  const productIds = products.map((product) => product.id);
  const aggregates = await prisma.productReview.groupBy({
    _avg: { rating: true },
    _count: { _all: true },
    by: ["productId"],
    where: { productId: { in: productIds } }
  });
  const summaries = new Map<string, StorefrontProductReviewSummary>(
    aggregates.map((aggregate) => [
      aggregate.productId,
      {
        averageRating:
          aggregate._avg.rating === null ? 0 : Math.round(aggregate._avg.rating * 10) / 10,
        reviewCount: aggregate._count._all
      }
    ])
  );

  return products.map((product) =>
    serializeStorefrontProduct(
      product,
      summaries.get(product.id) ?? { averageRating: 0, reviewCount: 0 }
    )
  );
}

export async function listStorefrontCategories() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    where: {
      AND: [
        approvedStorefrontCategoryWhere,
        { products: { some: temporaryImageReadyStorefrontProductWhere } }
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
        where: temporaryImageReadyStorefrontProductWhere
      },
      _count: {
        select: { products: { where: temporaryImageReadyStorefrontProductWhere } }
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
              { category: { name: { contains: search } } },
              { sku: { contains: search } },
              { barcode: { contains: search } }
            ]
          }
        : {})
    })
  });

  const visibleProducts = products.filter((product) => {
    const availableStock = getSellableStockQuantity(product.inventoryBatches);
    if (query.availability === "in-stock") return availableStock > 0;
    if (query.availability === "out-of-stock") return availableStock <= 0;
    return true;
  });
  const totalItems = visibleProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.pageSize;
  const pageProducts = visibleProducts.slice(start, start + query.pageSize);

  return {
    items: await serializeStorefrontProducts(pageProducts),
    meta: { page, pageSize: query.pageSize, totalItems, totalPages }
  };
}

export async function listStorefrontMerchandising(now = new Date()) {
  const products = await prisma.product.findMany({
    include: storefrontProductInclude,
    where: storefrontProductWhere()
  });
  const availableProductRecords = products.filter(
    (product) => getSellableStockQuantity(product.inventoryBatches) > 0
  );
  const productIds = availableProductRecords.map((product) => product.id);

  if (productIds.length === 0) {
    return {
      bestSellers: [],
      generatedAt: now.toISOString(),
      trending: [],
      trendingWindowDays: TRENDING_WINDOW_DAYS
    };
  }

  const trendingWindowStart = new Date(now.getTime() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [availableProducts, effectiveSeries, recentSaleItems] = await Promise.all([
    serializeStorefrontProducts(availableProductRecords),
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

  return (await serializeStorefrontProducts([product]))[0]!;
}

export async function listStorefrontProductReviews(
  productId: string,
  query: StorefrontProductReviewQuery
) {
  await requireStorefrontProduct(productId);

  const reviewWhere = {
    productId,
    ...(query.rating ? { rating: query.rating } : {})
  } satisfies Prisma.ProductReviewWhereInput;
  const [aggregate, groupedRatings, reviews, filteredCount] = await Promise.all([
    prisma.productReview.aggregate({
      _avg: { rating: true },
      _count: { _all: true },
      where: { productId }
    }),
    prisma.productReview.groupBy({
      _count: { _all: true },
      by: ["rating"],
      where: { productId }
    }),
    prisma.productReview.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        reviewerDisplayName: true,
        rating: true,
        comment: true,
        createdAt: true
      },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      where: reviewWhere
    }),
    prisma.productReview.count({ where: reviewWhere })
  ]);
  const distributionCounts = new Map(
    groupedRatings.map((entry) => [entry.rating, entry._count._all])
  );
  const totalReviews = aggregate._count._all;

  return {
    summary: {
      averageRating:
        aggregate._avg.rating === null ? null : Math.round(aggregate._avg.rating * 10) / 10,
      totalReviews,
      distribution: [5, 4, 3, 2, 1].map((rating) => {
        const count = distributionCounts.get(rating) ?? 0;
        return {
          rating,
          count,
          percentage: totalReviews === 0 ? 0 : Math.round((count / totalReviews) * 100)
        };
      })
    },
    reviews,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems: filteredCount,
      totalPages: Math.max(1, Math.ceil(filteredCount / query.pageSize))
    }
  };
}

export async function listStorefrontRelatedProducts(productId: string, limit = 4) {
  const product = await requireStorefrontProduct(productId);
  const sellableBatchWhere = {
    OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    quantityRemaining: { gt: 0 },
    status: { in: [InventoryBatchStatus.AVAILABLE, InventoryBatchStatus.LOW_STOCK] }
  } satisfies Prisma.InventoryBatchWhereInput;
  const candidateLimit = limit * STOREFRONT_RELATED_CANDIDATE_MULTIPLIER;
  const sameCategoryAvailable = (
    await prisma.product.findMany({
      include: storefrontProductInclude,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: candidateLimit,
      where: storefrontProductWhere({
        categoryId: product.category.id,
        id: { not: product.id },
        inventoryBatches: { some: sellableBatchWhere }
      })
    })
  )
    .filter((candidate) => getSellableStockQuantity(candidate.inventoryBatches) > 0)
    .slice(0, limit);
  const sameCategory = [...sameCategoryAvailable];

  if (sameCategory.length < limit) {
    const sameCategoryUnavailable = await prisma.product.findMany({
      include: storefrontProductInclude,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: limit - sameCategory.length,
      where: storefrontProductWhere({
        categoryId: product.category.id,
        id: { notIn: [product.id, ...sameCategory.map((candidate) => candidate.id)] }
      })
    });
    sameCategory.push(...sameCategoryUnavailable);
  }

  const fallback: StorefrontProductRecord[] = [];
  const fallbackLimit = limit - sameCategory.length;
  if (fallbackLimit > 0) {
    const fallbackAvailable = (
      await prisma.product.findMany({
        include: storefrontProductInclude,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: fallbackLimit * STOREFRONT_RELATED_CANDIDATE_MULTIPLIER,
        where: storefrontProductWhere({
          categoryId: { not: product.category.id },
          id: { not: product.id },
          inventoryBatches: { some: sellableBatchWhere }
        })
      })
    )
      .filter((candidate) => getSellableStockQuantity(candidate.inventoryBatches) > 0)
      .slice(0, fallbackLimit);
    fallback.push(...fallbackAvailable);

    if (fallback.length < fallbackLimit) {
      const fallbackUnavailable = await prisma.product.findMany({
        include: storefrontProductInclude,
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: fallbackLimit - fallback.length,
        where: storefrontProductWhere({
          categoryId: { not: product.category.id },
          id: {
            notIn: [product.id, ...fallback.map((candidate) => candidate.id)]
          }
        })
      });
      fallback.push(...fallbackUnavailable);
    }
  }

  const serializedProducts = await serializeStorefrontProducts([...sameCategory, ...fallback]);

  return {
    category: product.category,
    sameCategory: serializedProducts.slice(0, sameCategory.length),
    fallback: serializedProducts.slice(sameCategory.length)
  };
}

async function requireStorefrontProduct(productId: string) {
  const product = await prisma.product.findFirst({
    select: {
      id: true,
      category: { select: { id: true, name: true, slug: true } }
    },
    where: storefrontProductWhere({ id: productId })
  });

  if (!product) {
    throw new HttpError(404, "Product was not found in the storefront.", {
      code: "STOREFRONT_PRODUCT_NOT_FOUND"
    });
  }

  return product;
}

export async function createStorefrontOrder(
  input: StorefrontOrderInput,
  context: StorefrontOrderContext = {}
) {
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
        customerAccountId: context.customerAccountId ?? null,
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
      include: storefrontOrderInclude
    });

    return serializeStorefrontOrder(order);
  });
}

export async function listCustomerOrders(customerAccountId: string) {
  const orders = await prisma.customerOrder.findMany({
    include: storefrontOrderInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    where: { customerAccountId }
  });

  return orders.map(serializeStorefrontOrder);
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
