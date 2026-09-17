import type { Prisma } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import type { ListProductsQuery } from "../validators/product.validators.js";
import { buildPaginationMeta, type PaginationMeta } from "../utils/pagination.js";
import { serializeProduct, type ProductSummary } from "./catalogSerializers.js";

type ProductListResult = {
  items: ProductSummary[];
  meta: PaginationMeta;
};

const productInclude = {
  category: true,
  inventory: true,
  inventoryBatches: true,
  duplicateCandidatesLeft: { select: { status: true } },
  duplicateCandidatesRight: { select: { status: true } }
} as const;

async function resolveCategoryFilter(query: ListProductsQuery) {
  if (!query.category && !query.categoryId) {
    return undefined;
  }

  if (query.categoryId && query.category) {
    const category = await prisma.category.findFirst({
      where: {
        AND: [
          { id: query.categoryId },
          { OR: [{ name: query.category }, { slug: query.category }] }
        ]
      },
      select: { id: true }
    });

    return category ? [category.id] : [];
  }

  if (query.categoryId) {
    return [query.categoryId];
  }

  const categories = await prisma.category.findMany({
    where: {
      OR: [{ name: query.category }, { slug: query.category }]
    },
    select: { id: true }
  });

  return categories.map((category) => category.id);
}

function buildAvailabilityWhere(
  status: ListProductsQuery["status"]
): Prisma.ProductWhereInput | null {
  if (status === "ACTIVE") {
    return {
      status: "ACTIVE",
      inventory: {
        is: {
          quantityOnHand: { gt: 0 }
        }
      }
    };
  }

  if (status === "INACTIVE") {
    return {
      OR: [
        { status: "INACTIVE" },
        { status: "ACTIVE", inventory: { is: null } },
        {
          status: "ACTIVE",
          inventory: {
            is: {
              quantityOnHand: { lte: 0 }
            }
          }
        }
      ]
    };
  }

  if (status === "DISCONTINUED") {
    return { status: "DISCONTINUED" };
  }

  return null;
}

function buildProductWhere(
  query: ListProductsQuery,
  categoryIds?: string[]
): Prisma.ProductWhereInput {
  const clauses: Prisma.ProductWhereInput[] = [];
  const availabilityWhere = buildAvailabilityWhere(query.status);

  if (availabilityWhere) clauses.push(availabilityWhere);
  if (query.dataQualityStatus) clauses.push({ dataQualityStatus: query.dataQualityStatus });
  if (categoryIds !== undefined) {
    clauses.push({ categoryId: categoryIds.length > 0 ? { in: categoryIds } : { in: [] } });
  }
  if (query.sku) clauses.push({ sku: query.sku });
  if (query.barcode) {
    clauses.push({
      OR: [{ barcode: query.barcode }, { barcodes: { some: { barcode: query.barcode } } }]
    });
  }
  if (query.search) {
    clauses.push({
      OR: [
        { name: { contains: query.search } },
        { sku: { contains: query.search } },
        { barcode: { contains: query.search } },
        { barcodes: { some: { barcode: { contains: query.search } } } }
      ]
    });
  }

  return clauses.length > 0 ? { AND: clauses } : {};
}

function buildProductOrderBy(query: ListProductsQuery) {
  return [{ [query.sortBy]: query.sortOrder }, { id: "asc" as const }];
}

export async function listCatalogProducts(query: ListProductsQuery): Promise<ProductListResult> {
  const categoryIds = await resolveCategoryFilter(query);

  if (categoryIds !== undefined && categoryIds.length === 0) {
    return {
      items: [],
      meta: buildPaginationMeta(0, {
        page: query.page,
        pageSize: query.pageSize
      })
    };
  }

  const where = buildProductWhere(query, categoryIds);
  const totalItems = await prisma.product.count({ where });
  const items = await prisma.product.findMany({
    include: productInclude,
    orderBy: buildProductOrderBy(query),
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
    where
  });

  return {
    items: items.map(serializeProduct),
    meta: buildPaginationMeta(totalItems, {
      page: query.page,
      pageSize: query.pageSize
    })
  };
}
