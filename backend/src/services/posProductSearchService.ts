import type { Prisma } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { operationalProductWhere } from "./catalogQualityPolicy.js";
import { resolveProductBarcode } from "./productBarcodeService.js";
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

function buildPosWhere(query: string) {
  const normalizedQuery = query.trim();

  return operationalProductWhere(
    normalizedQuery
      ? {
          status: "ACTIVE" as const,
          OR: [
            { name: { contains: normalizedQuery } },
            { sku: { contains: normalizedQuery } },
            { barcode: { contains: normalizedQuery } },
            { barcodes: { some: { barcode: { contains: normalizedQuery } } } },
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
        }
  );
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

async function findExactIdentityProduct(query: string) {
  const skuMatch = await prisma.product.findFirst({
    include: posProductInclude,
    where: operationalProductWhere({
      status: "ACTIVE",
      sku: query
    })
  });

  if (skuMatch) {
    return {
      matchedBarcode: skuMatch.barcode,
      product: skuMatch
    };
  }

  if (query.length > 80) return null;

  const barcodeResolution = await resolveProductBarcode(query);
  if (!barcodeResolution.found || !barcodeResolution.product) return null;

  const product = await prisma.product.findFirst({
    include: posProductInclude,
    where: operationalProductWhere({
      id: barcodeResolution.product.id,
      status: "ACTIVE"
    })
  });

  if (!product) return null;

  return {
    matchedBarcode: barcodeResolution.barcode,
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
