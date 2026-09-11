import { CatalogQualityStatus, CatalogRecordSource, Prisma } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { operationalProductWhere } from "./catalogQualityPolicy.js";
import { getSellableStockQuantity } from "./stockDomainService.js";

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

const posProductInclude = {
  category: true,
  inventoryBatches: true,
  barcodes: {
    select: { barcode: true }
  }
} as const;

type PosProductRecord = Prisma.ProductGetPayload<{ include: typeof posProductInclude }>;

function parseSellingPriceQuery(query: string) {
  const normalized = query.trim().replace(/^₱\s*/u, "").replaceAll(",", "");

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;

  try {
    return new Prisma.Decimal(normalized);
  } catch {
    return null;
  }
}

function buildIdentitySearchConditions(query: string): Prisma.ProductWhereInput[] {
  return [
    { name: { contains: query } },
    { sku: { contains: query } },
    { barcode: { contains: query } },
    { barcodes: { some: { barcode: { contains: query } } } },
    { description: { contains: query } },
    {
      category: {
        name: {
          contains: query
        }
      }
    }
  ];
}

function buildMappedSourceAliasCondition(query: string): Prisma.ProductWhereInput {
  return {
    canonicalMappings: {
      some: {
        sourceProduct: {
          is: {
            dataQualityStatus: { not: CatalogQualityStatus.REJECTED },
            recordSource: { not: CatalogRecordSource.TEST_FIXTURE },
            OR: buildIdentitySearchConditions(query)
          }
        }
      }
    }
  };
}

function buildPosWhere(query: string) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return operationalProductWhere({ status: "ACTIVE" as const });
  }

  const searchConditions: Prisma.ProductWhereInput[] = [
    ...buildIdentitySearchConditions(normalizedQuery),
    buildMappedSourceAliasCondition(normalizedQuery)
  ];

  const sellingPrice = parseSellingPriceQuery(normalizedQuery);
  if (sellingPrice !== null) {
    searchConditions.push({ sellingPrice });
  }

  return operationalProductWhere({
    status: "ACTIVE" as const,
    OR: searchConditions
  });
}

function serializePosProduct(
  product: PosProductRecord,
  matchedBarcode?: string | null
): PosProductResult {
  return {
    availableStock: getSellableStockQuantity(product.inventoryBatches),
    barcode: matchedBarcode ?? product.barcode,
    categoryName: product.category.name,
    id: product.id,
    isActive: product.status === "ACTIVE",
    name: product.name,
    sku: product.sku,
    sellingPrice: product.sellingPrice.toString(),
    unit: product.unit
  };
}

async function loadOperationalProduct(productId: string) {
  return prisma.product.findFirst({
    include: posProductInclude,
    where: operationalProductWhere({
      id: productId,
      status: "ACTIVE"
    })
  });
}

async function findExactIdentityProduct(query: string) {
  const identityMatch = await prisma.product.findFirst({
    select: {
      barcode: true,
      barcodes: {
        select: { barcode: true }
      },
      id: true,
      sourceMapping: {
        select: { canonicalProductId: true }
      }
    },
    where: {
      dataQualityStatus: { not: CatalogQualityStatus.REJECTED },
      recordSource: { not: CatalogRecordSource.TEST_FIXTURE },
      OR: [{ sku: query }, { barcode: query }, { barcodes: { some: { barcode: query } } }]
    }
  });

  if (!identityMatch) return null;

  const targetProductId = identityMatch.sourceMapping?.canonicalProductId ?? identityMatch.id;
  const product = await loadOperationalProduct(targetProductId);
  if (!product) return null;

  const matchedBarcode =
    identityMatch.barcode === query ||
    identityMatch.barcodes.some((registration) => registration.barcode === query)
      ? query
      : product.barcode;

  return {
    matchedBarcode,
    product
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

  if (normalizedQuery) {
    const exactIdentityMatch = await findExactIdentityProduct(normalizedQuery);
    if (exactIdentityMatch) {
      return {
        catalogCount: 1,
        query: normalizedQuery,
        products: [
          serializePosProduct(exactIdentityMatch.product, exactIdentityMatch.matchedBarcode)
        ],
        meta: {
          page: 1,
          pageSize: options.pageSize,
          totalItems: 1,
          totalPages: 1
        }
      };
    }
  }

  const where = buildPosWhere(normalizedQuery);
  const totalItems = await prisma.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalItems / options.pageSize));
  const page = Math.min(Math.max(options.page, 1), totalPages);

  const products = await prisma.product.findMany({
    include: posProductInclude,
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

  const normalizedQueryKey = normalizedQuery.toLowerCase();

  return {
    catalogCount: totalItems,
    query: normalizedQuery,
    products: products.map((product) => {
      const matchedBarcode = normalizedQuery
        ? product.barcodes.find(
            (registration) => registration.barcode.toLowerCase() === normalizedQueryKey
          )?.barcode
        : undefined;

      return serializePosProduct(product, matchedBarcode);
    }),
    meta: {
      page,
      pageSize: options.pageSize,
      totalItems,
      totalPages
    }
  };
}
