import { randomBytes } from "node:crypto";

import { CustomerOrderStatus, Prisma, SaleStatus, type ProductSizeUnit } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { approvedCategoryCoverUrl } from "../modules/catalog-image/categoryImageService.js";
import { compareStorefrontCategoryNames } from "../modules/catalog/storefront-category-taxonomy.js";
import { getEffectiveMonthlySeries } from "../modules/forecasting/effective-sales.service.js";
import {
  buildProductSizeFamilyKey,
  extractCanonicalProductSize,
  normalizeProductIdentity
} from "../utils/catalogIdentity.js";
import { HttpError } from "../utils/httpError.js";
import type {
  StorefrontOrderInput,
  StorefrontProductReviewMutation,
  StorefrontProductReviewQuery,
  StorefrontProductQuery
} from "../validators/storefront.validators.js";
import {
  isPresentationCatalogEnabled,
  storefrontCategoryProductWhere,
  storefrontCategoryWhere,
  storefrontProductWhere
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
const TRENDING_MINIMUM_AVERAGE_RATING = 4;

function stockStatus(availableStock: number, reorderLevel: number) {
  if (availableStock <= 0) return "OUT_OF_STOCK" as const;
  if (availableStock <= reorderLevel) return "LOW_STOCK" as const;
  return "IN_STOCK" as const;
}

type ResolvedProductSize = {
  baseValue: number;
  dimension: "COUNT" | "VOLUME" | "WEIGHT";
  sizeUnit: ProductSizeUnit;
  sizeValue: string;
};

function resolveProductSize(
  product: Pick<StorefrontProductRecord, "name" | "sizeUnit" | "sizeValue">
): ResolvedProductSize | null {
  const extracted = extractCanonicalProductSize(product.name);
  const sizeUnit = product.sizeUnit ?? extracted.sizeUnit;
  const sizeValue = product.sizeValue?.toString() ?? extracted.sizeValue;

  if (!sizeUnit || !sizeValue) return null;

  const numericValue = Number(sizeValue);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;

  switch (sizeUnit) {
    case "LITER":
      return {
        baseValue: numericValue * 1000,
        dimension: "VOLUME",
        sizeUnit,
        sizeValue
      };
    case "MILLILITER":
      return {
        baseValue: numericValue,
        dimension: "VOLUME",
        sizeUnit,
        sizeValue
      };
    case "KILOGRAM":
      return {
        baseValue: numericValue * 1000,
        dimension: "WEIGHT",
        sizeUnit,
        sizeValue
      };
    case "GRAM":
      return {
        baseValue: numericValue,
        dimension: "WEIGHT",
        sizeUnit,
        sizeValue
      };
    case "PIECE":
      return {
        baseValue: numericValue,
        dimension: "COUNT",
        sizeUnit,
        sizeValue
      };
  }
}

function isPackageConfiguration(unit: StorefrontProductRecord["unit"]) {
  return unit === "PACK" || unit === "BOX";
}

function packagingLabel(unit: StorefrontProductRecord["unit"]) {
  switch (unit) {
    case "BOX":
      return "Box";
    case "PACK":
      return "Pack";
    case "BOTTLE":
      return "Bottle";
    case "SACHET":
      return "Sachet";
    case "KILOGRAM":
      return "Kilogram";
    case "GRAM":
      return "Gram";
    case "LITER":
      return "Liter";
    case "MILLILITER":
      return "Milliliter";
    default:
      return "Single";
  }
}

function isSameSizeVariantFamily(left: StorefrontProductRecord, right: StorefrontProductRecord) {
  return buildProductSizeFamilyKey(left) === buildProductSizeFamilyKey(right);
}

function sizeTier(index: number, count: number) {
  if (count <= 1) return null;
  if (count === 2) return index === 0 ? ("SMALL" as const) : ("LARGE" as const);
  if (count === 3) return (["SMALL", "MEDIUM", "LARGE"] as const)[index] ?? null;

  const position = index / Math.max(1, count - 1);
  if (position < 1 / 3) return "SMALL" as const;
  if (position < 2 / 3) return "MEDIUM" as const;
  return "LARGE" as const;
}

async function listStorefrontSizeVariants(product: StorefrontProductRecord) {
  const selectedSize = resolveProductSize(product);
  if (!selectedSize) return [];

  const candidates = (
    await prisma.product.findMany({
      include: storefrontProductInclude,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      where: storefrontProductWhere({ categoryId: product.categoryId })
    })
  )
    .map((candidate) => {
      const size = resolveProductSize(candidate);
      if (!size || !isSameSizeVariantFamily(product, candidate)) return null;

      const packageConfiguration = isPackageConfiguration(candidate.unit);
      const compatibleDimension =
        size.dimension === selectedSize.dimension ||
        packageConfiguration ||
        isPackageConfiguration(product.unit);
      if (!compatibleDimension) return null;

      const availableStock = getSellableStockQuantity(candidate.inventoryBatches);
      return {
        id: candidate.id,
        name: candidate.name,
        imageUrl: candidate.imageUrl,
        sellingPrice: candidate.sellingPrice.toString(),
        availableStock,
        stockStatus: stockStatus(availableStock, candidate.reorderLevel),
        sizeValue: size.sizeValue,
        sizeUnit: size.sizeUnit,
        unit: candidate.unit,
        packageConfiguration,
        sortValue: size.baseValue
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    .sort(
      (left, right) =>
        Number(left.packageConfiguration) - Number(right.packageConfiguration) ||
        left.sortValue - right.sortValue ||
        left.name.localeCompare(right.name) ||
        left.id.localeCompare(right.id)
    );

  const physicalCandidates = candidates.filter((candidate) => !candidate.packageConfiguration);
  const physicalTier = new Map(
    physicalCandidates.map((candidate, index) => [
      candidate.id,
      sizeTier(index, physicalCandidates.length)
    ])
  );

  return candidates.map((candidate) => ({
    id: candidate.id,
    name: candidate.name,
    imageUrl: candidate.imageUrl,
    sellingPrice: candidate.sellingPrice,
    availableStock: candidate.availableStock,
    stockStatus: candidate.stockStatus,
    sizeValue: candidate.sizeValue,
    sizeUnit: candidate.sizeUnit,
    unit: candidate.unit,
    packagingLabel: packagingLabel(candidate.unit),
    sizeTier: physicalTier.get(candidate.id) ?? null
  }));
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
    where: { productId: { in: productIds }, status: "VISIBLE" }
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
  const presentationMode = isPresentationCatalogEnabled();
  const categoryWhere = storefrontCategoryWhere(presentationMode);
  const categoryProductWhere = storefrontCategoryProductWhere(presentationMode);

  const categories = await prisma.category.findMany({
    where: {
      AND: [categoryWhere, { products: { some: categoryProductWhere } }]
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      activeCoverAssetId: true,
      coverPosition: true,
      coverStatus: true,
      _count: {
        select: { products: { where: categoryProductWhere } }
      }
    }
  });

  return categories
    .sort((left, right) => compareStorefrontCategoryNames(left.name, right.name))
    .map(({ _count, activeCoverAssetId, coverPosition, coverStatus, ...category }) => ({
      ...category,
      productCount: _count.products,
      storefrontCover:
        activeCoverAssetId && coverStatus === "READY"
          ? {
              imageUrl: approvedCategoryCoverUrl(activeCoverAssetId, "cover"),
              position: coverPosition
            }
          : null
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

  const trendingWindowStart = new Date(
    now.getTime() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );
  const [
    availableProducts,
    effectiveSeries,
    historicalMappings,
    recentReviews,
    recentFavoriteCounts
  ] = await Promise.all([
    serializeStorefrontProducts(availableProductRecords),
    getEffectiveMonthlySeries(productIds),
    prisma.sarimaSourceProductMapping.findMany({
      select: { canonicalProductId: true, totalHistoricalUnits: true },
      where: { canonicalProductId: { in: productIds } }
    }),
    prisma.productReview.findMany({
      select: { productId: true, rating: true, comment: true, createdAt: true },
      where: {
        customerAccountId: { not: null },
        verifiedOrderId: { not: null },
        productId: { in: productIds },
        status: "VISIBLE",
        createdAt: { gte: trendingWindowStart, lte: now },
        customerAccount: { is: { status: "ACTIVE" } }
      }
    }),
    prisma.customerFavorite.groupBy({
      _count: { _all: true },
      by: ["productId"],
      where: {
        createdAt: { gte: trendingWindowStart, lte: now },
        productId: { in: productIds }
      }
    })
  ]);

  const historicalUnits = new Map(
    effectiveSeries.map((series) => [
      series.productId,
      series.points.reduce((total, point) => total + point.quantitySold, 0)
    ])
  );
  for (const mapping of historicalMappings) {
    if ((historicalUnits.get(mapping.canonicalProductId) ?? 0) <= 0) {
      historicalUnits.set(mapping.canonicalProductId, mapping.totalHistoricalUnits);
    }
  }

  const favoriteCounts = new Map(
    recentFavoriteCounts.map((entry) => [entry.productId, entry._count._all])
  );
  const reviewSignals = new Map<
    string,
    Array<{ rating: number; createdAt: Date; hasComment: boolean }>
  >();
  for (const review of recentReviews) {
    const values = reviewSignals.get(review.productId) ?? [];
    values.push({
      rating: review.rating,
      createdAt: review.createdAt,
      hasComment: review.comment.trim().length >= 3
    });
    reviewSignals.set(review.productId, values);
  }

  const trending = availableProducts
    .flatMap((product) => {
      const reviews = reviewSignals.get(product.id) ?? [];
      const commentedReviews = reviews.filter((review) => review.hasComment);
      if (commentedReviews.length === 0) return [];

      const averageRating =
        commentedReviews.reduce((sum, review) => sum + review.rating, 0) / commentedReviews.length;
      if (averageRating < TRENDING_MINIMUM_AVERAGE_RATING) return [];

      const bayesianRating =
        (averageRating * commentedReviews.length + 4 * 4) / (commentedReviews.length + 4);
      const confidence = Math.min(1, Math.log1p(commentedReviews.length) / Math.log(9));
      const recency =
        commentedReviews.reduce((sum, review) => {
          const ageDays = Math.max(0, (now.getTime() - review.createdAt.getTime()) / 86_400_000);
          return sum + Math.exp(-ageDays / 14);
        }, 0) / commentedReviews.length;
      const favoriteCount = favoriteCounts.get(product.id) ?? 0;
      const favoriteSignal = Math.min(1, Math.log1p(favoriteCount) / Math.log(13));
      const score =
        (bayesianRating / 5) * 0.62 + confidence * 0.2 + recency * 0.13 + favoriteSignal * 0.05;

      return [
        {
          product,
          score,
          recentReviewCount: commentedReviews.length,
          favoriteCount
        }
      ];
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.recentReviewCount - left.recentReviewCount ||
        right.favoriteCount - left.favoriteCount ||
        left.product.name.localeCompare(right.product.name)
    )
    .slice(0, STOREFRONT_MERCHANDISING_LIMIT)
    .map((entry, index) => ({
      product: entry.product,
      rank: index + 1,
      unitsSold: 0,
      trendingScore: Math.round(entry.score * 1000) / 1000,
      recentReviewCount: entry.recentReviewCount,
      favoriteCount: entry.favoriteCount
    }));

  return {
    bestSellers: rankStorefrontProducts(availableProducts, historicalUnits).map((entry) => ({
      ...entry,
      trendingScore: 0,
      recentReviewCount: 0,
      favoriteCount: 0
    })),
    generatedAt: now.toISOString(),
    trending,
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

  const [serializedProduct, sizeVariants] = await Promise.all([
    serializeStorefrontProducts([product]).then((products) => products[0]!),
    listStorefrontSizeVariants(product)
  ]);

  return {
    ...serializedProduct,
    sizeVariants
  };
}

export async function listStorefrontProductReviews(
  productId: string,
  query: StorefrontProductReviewQuery
) {
  await requireStorefrontProduct(productId);

  const reviewWhere = {
    productId,
    status: "VISIBLE" as const,
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
        createdAt: true,
        verifiedOrderId: true
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
    reviews: reviews.map((review) => ({
      ...review,
      verifiedPurchase: Boolean(review.verifiedOrderId)
    })),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems: filteredCount,
      totalPages: Math.max(1, Math.ceil(filteredCount / query.pageSize))
    }
  };
}

export async function listCustomerFavoriteProducts(customerAccountId: string) {
  const favorites = await prisma.customerFavorite.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { productId: true, createdAt: true },
    where: { customerAccountId }
  });
  if (favorites.length === 0) return [];

  const productIds = favorites.map((favorite) => favorite.productId);
  const products = await prisma.product.findMany({
    include: storefrontProductInclude,
    where: storefrontProductWhere({ id: { in: productIds } })
  });
  const serialized = await serializeStorefrontProducts(products);
  const productMap = new Map(serialized.map((product) => [product.id, product]));

  return favorites.flatMap((favorite) => {
    const product = productMap.get(favorite.productId);
    return product ? [{ ...product, favoritedAt: favorite.createdAt }] : [];
  });
}

export async function addCustomerFavorite(customerAccountId: string, productId: string) {
  await requireStorefrontProduct(productId);
  await prisma.customerFavorite.upsert({
    create: { customerAccountId, productId },
    update: {},
    where: {
      customerAccountId_productId: { customerAccountId, productId }
    }
  });
  return { productId, favorited: true as const };
}

export async function removeCustomerFavorite(customerAccountId: string, productId: string) {
  await prisma.customerFavorite.deleteMany({
    where: { customerAccountId, productId }
  });
  return { productId, favorited: false as const };
}

export async function getCustomerReviewContext(
  customerAccountId: string,
  productId: string
) {
  await requireStorefrontProduct(productId);
  const [existingReview, verifiedOrder] = await Promise.all([
    prisma.productReview.findUnique({
      where: {
        customerAccountId_productId: { customerAccountId, productId }
      }
    }),
    prisma.customerOrder.findFirst({
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: { id: true, orderNumber: true, updatedAt: true },
      where: {
        customerAccountId,
        status: CustomerOrderStatus.COMPLETED,
        items: { some: { productId } }
      }
    })
  ]);

  return {
    eligible: Boolean(verifiedOrder),
    reason: verifiedOrder
      ? null
      : "A completed signed-in purchase of this product is required before publishing a review.",
    verifiedOrder: verifiedOrder
      ? {
          id: verifiedOrder.id,
          orderNumber: verifiedOrder.orderNumber,
          completedAt: verifiedOrder.updatedAt
        }
      : null,
    review: existingReview
      ? {
          id: existingReview.id,
          rating: existingReview.rating,
          comment: existingReview.comment,
          status: existingReview.status,
          createdAt: existingReview.createdAt,
          updatedAt: existingReview.updatedAt,
          verifiedPurchase: Boolean(existingReview.verifiedOrderId)
        }
      : null
  };
}

export async function upsertCustomerProductReview(
  customerAccountId: string,
  productId: string,
  input: StorefrontProductReviewMutation
) {
  await requireStorefrontProduct(productId);
  const [customer, verifiedOrder, existingReview] = await Promise.all([
    prisma.customerAccount.findUnique({
      select: { id: true, name: true, status: true },
      where: { id: customerAccountId }
    }),
    prisma.customerOrder.findFirst({
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: { id: true },
      where: {
        customerAccountId,
        status: CustomerOrderStatus.COMPLETED,
        items: { some: { productId } }
      }
    }),
    prisma.productReview.findUnique({
      select: { id: true, status: true },
      where: {
        customerAccountId_productId: { customerAccountId, productId }
      }
    })
  ]);

  if (!customer || customer.status !== "ACTIVE") {
    throw new HttpError(403, "This customer account cannot publish reviews.", {
      code: "CUSTOMER_REVIEW_ACCOUNT_INELIGIBLE"
    });
  }
  if (!verifiedOrder) {
    throw new HttpError(403, "A completed purchase is required before reviewing this product.", {
      code: "CUSTOMER_REVIEW_PURCHASE_REQUIRED"
    });
  }
  if (existingReview && existingReview.status !== "VISIBLE") {
    throw new HttpError(409, "This review is currently under moderation and cannot be republished.", {
      code: "CUSTOMER_REVIEW_MODERATED"
    });
  }

  const comment = normalizeReviewComment(input.comment);
  const review = existingReview
    ? await prisma.productReview.update({
        data: {
          comment,
          rating: input.rating,
          reviewerDisplayName: customer.name,
          verifiedOrderId: verifiedOrder.id
        },
        where: { id: existingReview.id }
      })
    : await prisma.productReview.create({
        data: {
          comment,
          customerAccountId,
          productId,
          rating: input.rating,
          reviewerDisplayName: customer.name,
          verifiedOrderId: verifiedOrder.id
        }
      });

  return {
    id: review.id,
    rating: review.rating,
    comment: review.comment,
    status: review.status,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    verifiedPurchase: true
  };
}

function normalizeReviewComment(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  const urlCount = (normalized.match(/https?:\/\//gi) ?? []).length;
  if (urlCount > 1) {
    throw new HttpError(422, "Review comments cannot contain repeated promotional links.", {
      code: "CUSTOMER_REVIEW_SPAM"
    });
  }
  if (/(.)\1{11,}/i.test(normalized)) {
    throw new HttpError(422, "Review comment appears to contain repeated spam text.", {
      code: "CUSTOMER_REVIEW_SPAM"
    });
  }
  return normalized;
}

export async function listStorefrontRelatedProducts(productId: string, limit = 4) {
  const product = await requireStorefrontProduct(productId);
  const candidateLimit = Math.max(limit * STOREFRONT_RELATED_CANDIDATE_MULTIPLIER, limit);

  const candidates = await prisma.product.findMany({
    include: storefrontProductInclude,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: candidateLimit,
    where: storefrontProductWhere({
      categoryId: product.category.id,
      id: { not: product.id }
    })
  });

  const currentBrand = product.brand ? normalizeProductIdentity(product.brand) : "";
  const sameCategory = candidates
    .sort((left, right) => {
      const leftBrandMatch =
        Boolean(currentBrand) && normalizeProductIdentity(left.brand ?? "") === currentBrand;
      const rightBrandMatch =
        Boolean(currentBrand) && normalizeProductIdentity(right.brand ?? "") === currentBrand;
      if (leftBrandMatch !== rightBrandMatch) return leftBrandMatch ? -1 : 1;

      const leftAvailable = getSellableStockQuantity(left.inventoryBatches) > 0;
      const rightAvailable = getSellableStockQuantity(right.inventoryBatches) > 0;
      if (leftAvailable !== rightAvailable) return leftAvailable ? -1 : 1;

      return left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
    })
    .slice(0, limit);

  return {
    category: product.category,
    sameCategory: await serializeStorefrontProducts(sameCategory),
    fallback: []
  };
}

async function requireStorefrontProduct(productId: string) {
  const product = await prisma.product.findFirst({
    select: {
      id: true,
      brand: true,
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

    if (context.customerAccountId) {
      await tx.customerCartItem.deleteMany({
        where: { customerAccountId: context.customerAccountId }
      });
    }

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
