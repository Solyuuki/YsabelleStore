import { Prisma } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import {
  normalizeCode,
  normalizeOptionalCode,
  normalizeOptionalString,
  normalizeSlug,
  normalizeWhitespace
} from "../utils/normalizers.js";
import { buildPaginationMeta, type PaginationMeta } from "../utils/pagination.js";
import type {
  CreateProductRequest,
  ListProductsQuery,
  ProductAvailabilityStatusRequest,
  UpdateProductRequest
} from "../validators/product.validators.js";
import {
  serializeCategory,
  computeStockStatus,
  serializeProduct,
  type ProductSummary,
  type ProductWithRelations
} from "./catalogSerializers.js";
import { assertStockInvariant } from "./stockDomainService.js";

type ProductListResult = {
  items: ProductSummary[];
  meta: PaginationMeta;
};

const productInclude = {
  category: true,
  inventory: true
} as const;

function isKnownPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

function toDecimal(value: string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function normalizeProductInput(input: CreateProductRequest | UpdateProductRequest) {
  return {
    name: input.name ? normalizeWhitespace(input.name) : undefined,
    sku: input.sku ? normalizeCode(input.sku) : undefined,
    barcode: input.barcode === undefined ? undefined : normalizeOptionalCode(input.barcode),
    categoryId: input.categoryId ? input.categoryId.trim() : undefined,
    description:
      input.description === undefined ? undefined : normalizeOptionalString(input.description),
    imageUrl:
      input.imageUrl === undefined
        ? undefined
        : input.imageUrl === null
          ? null
          : normalizeWhitespace(input.imageUrl),
    status: input.status,
    unit: input.unit,
    costPrice: input.costPrice ? toDecimal(String(input.costPrice)) : undefined,
    sellingPrice: input.sellingPrice ? toDecimal(String(input.sellingPrice)) : undefined,
    reorderLevel: input.reorderLevel,
    targetStockLevel: input.targetStockLevel
  };
}

function throwDuplicateProductError(field: "sku" | "barcode") {
  throw new HttpError(409, `A product with this ${field} already exists.`, {
    code: field === "sku" ? "PRODUCT_SKU_EXISTS" : "PRODUCT_BARCODE_EXISTS"
  });
}

async function ensureCategoryExists(categoryId: string) {
  const category = await prisma.category.findUnique({
    where: {
      id: categoryId
    }
  });

  if (!category) {
    throw new HttpError(404, "Category not found.", {
      code: "CATEGORY_NOT_FOUND"
    });
  }

  return category;
}

function buildCategorySlug(name: string, slug?: string) {
  const source = slug ? slug : name;
  const normalized = normalizeSlug(source);

  if (!normalized) {
    throw new HttpError(400, "Category slug could not be derived.", {
      code: "INVALID_CATEGORY_SLUG"
    });
  }

  return normalized.slice(0, 140);
}

function throwDuplicateCategoryError(field: "name" | "slug") {
  throw new HttpError(409, "Category already exists.", {
    code: "CATEGORY_ALREADY_EXISTS",
    details: {
      field
    }
  });
}

async function ensureProductAvailability(productId: string): Promise<ProductWithRelations> {
  const product = await prisma.product.findUnique({
    include: productInclude,
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

async function detectDuplicateProductSku(sku: string, productId?: string) {
  const existing = await prisma.product.findUnique({
    where: {
      sku
    },
    select: {
      id: true
    }
  });

  if (existing && existing.id !== productId) {
    throwDuplicateProductError("sku");
  }
}

async function detectDuplicateProductBarcode(barcode: string | undefined, productId?: string) {
  if (!barcode) {
    return;
  }

  const existing = await prisma.product.findUnique({
    where: {
      barcode
    },
    select: {
      id: true
    }
  });

  if (existing && existing.id !== productId) {
    throwDuplicateProductError("barcode");
  }
}

async function detectDuplicateCategoryName(name: string) {
  const existing = await prisma.category.findUnique({
    where: {
      name
    },
    select: {
      id: true
    }
  });

  if (existing) {
    throwDuplicateCategoryError("name");
  }
}

async function detectDuplicateCategorySlug(slug: string) {
  const existing = await prisma.category.findUnique({
    where: {
      slug
    },
    select: {
      id: true
    }
  });

  if (existing) {
    throwDuplicateCategoryError("slug");
  }
}

async function resolveCategoryFilter(query: ListProductsQuery) {
  if (!query.category && !query.categoryId) {
    return undefined;
  }

  if (query.categoryId && query.category) {
    const category = await prisma.category.findFirst({
      where: {
        AND: [
          { id: query.categoryId },
          {
            OR: [{ name: query.category }, { slug: query.category }]
          }
        ]
      },
      select: {
        id: true
      }
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
    select: {
      id: true
    }
  });

  return categories.map((category) => category.id);
}

function buildProductWhere(query: ListProductsQuery, categoryIds?: string[]) {
  const where: Prisma.ProductWhereInput = {};

  if (query.status) {
    where.status = query.status;
  }

  if (categoryIds !== undefined) {
    where.categoryId = categoryIds.length > 0 ? { in: categoryIds } : { in: [] };
  }

  if (query.sku) {
    where.sku = query.sku;
  }

  if (query.barcode) {
    where.barcode = query.barcode;
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search } },
      { sku: { contains: query.search } },
      { barcode: { contains: query.search } }
    ];
  }

  return where;
}

function buildProductOrderBy(query: ListProductsQuery) {
  const orderDirection = query.sortOrder;

  return [{ [query.sortBy]: orderDirection }, { id: "asc" as const }];
}

function asProductSummary(product: ProductWithRelations): ProductSummary {
  return serializeProduct(product);
}

export async function createProduct(input: CreateProductRequest): Promise<ProductSummary> {
  const normalized = normalizeProductInput(input);
  const {
    name,
    sku,
    barcode,
    categoryId,
    description,
    imageUrl,
    status,
    unit,
    costPrice,
    sellingPrice,
    reorderLevel,
    targetStockLevel
  } = normalized;

  if (!name || !sku || !categoryId || costPrice === undefined || sellingPrice === undefined) {
    throw new HttpError(400, "Product request is incomplete.", {
      code: "INVALID_PRODUCT_REQUEST"
    });
  }

  await ensureCategoryExists(categoryId);
  await detectDuplicateProductSku(sku);
  await detectDuplicateProductBarcode(barcode);

  try {
    const product = await prisma.$transaction(async (tx) => {
      const createdProduct = await tx.product.create({
        data: {
          name,
          sku,
          barcode,
          categoryId,
          description,
          imageUrl,
          unit: unit ?? "PIECE",
          costPrice,
          sellingPrice,
          reorderLevel: reorderLevel ?? 0,
          targetStockLevel: targetStockLevel ?? 0,
          status: status ?? "ACTIVE"
        }
      });

      await tx.inventory.create({
        data: {
          productId: createdProduct.id,
          quantityOnHand: 0,
          version: 0
        }
      });

      await assertStockInvariant(tx, createdProduct.id);

      return tx.product.findUniqueOrThrow({
        include: productInclude,
        where: {
          id: createdProduct.id
        }
      });
    });

    return asProductSummary(product);
  } catch (error) {
    if (isKnownPrismaError(error) && error.code === "P2002") {
      const fields = Array.isArray(error.meta?.target) ? error.meta?.target : [];

      if (fields.includes("sku")) {
        throwDuplicateProductError("sku");
      }

      if (fields.includes("barcode")) {
        throwDuplicateProductError("barcode");
      }
    }

    throw error;
  }
}

export async function listProducts(query: ListProductsQuery): Promise<ProductListResult> {
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
    items: items.map(asProductSummary),
    meta: buildPaginationMeta(totalItems, {
      page: query.page,
      pageSize: query.pageSize
    })
  };
}

export async function getProductById(productId: string): Promise<ProductSummary> {
  const product = await ensureProductAvailability(productId);

  return asProductSummary(product);
}

export async function updateProduct(
  productId: string,
  input: UpdateProductRequest
): Promise<ProductSummary> {
  const existingProduct = await ensureProductAvailability(productId);
  const normalized = normalizeProductInput(input);
  const data: Prisma.ProductUpdateInput = {};

  if (normalized.name !== undefined) {
    data.name = normalized.name;
  }

  if (normalized.sku !== undefined) {
    await detectDuplicateProductSku(normalized.sku, existingProduct.id);
    data.sku = normalized.sku;
  }

  if (normalized.barcode !== undefined) {
    await detectDuplicateProductBarcode(normalized.barcode, existingProduct.id);
    data.barcode = normalized.barcode;
  }

  if (normalized.categoryId !== undefined) {
    await ensureCategoryExists(normalized.categoryId);
    data.category = {
      connect: {
        id: normalized.categoryId
      }
    };
  }

  if (normalized.description !== undefined) {
    data.description = normalized.description;
  }

  if (normalized.imageUrl !== undefined) {
    data.imageUrl = normalized.imageUrl;
  }

  if (normalized.unit !== undefined) {
    data.unit = normalized.unit;
  }

  if (normalized.costPrice !== undefined) {
    data.costPrice = normalized.costPrice;
  }

  if (normalized.sellingPrice !== undefined) {
    data.sellingPrice = normalized.sellingPrice;
  }

  if (normalized.reorderLevel !== undefined) {
    data.reorderLevel = normalized.reorderLevel;
  }

  if (normalized.targetStockLevel !== undefined) {
    data.targetStockLevel = normalized.targetStockLevel;
  }

  if (normalized.status !== undefined) {
    data.status = normalized.status;
  }

  if (Object.keys(data).length === 0) {
    throw new HttpError(400, "At least one product field must be supplied.", {
      code: "EMPTY_PRODUCT_UPDATE"
    });
  }

  try {
    const updatedProduct = await prisma.product.update({
      data,
      include: productInclude,
      where: {
        id: existingProduct.id
      }
    });

    return asProductSummary(updatedProduct);
  } catch (error) {
    if (isKnownPrismaError(error) && error.code === "P2002") {
      const fields = Array.isArray(error.meta?.target) ? error.meta?.target : [];

      if (fields.includes("sku")) {
        throwDuplicateProductError("sku");
      }

      if (fields.includes("barcode")) {
        throwDuplicateProductError("barcode");
      }
    }

    throw error;
  }
}

export async function changeProductStatus(
  productId: string,
  input: ProductAvailabilityStatusRequest
): Promise<ProductSummary> {
  const existingProduct = await ensureProductAvailability(productId);

  if (existingProduct.status === "DISCONTINUED") {
    throw new HttpError(409, "Discontinued products cannot use the availability action.", {
      code: "INVALID_PRODUCT_STATUS_TRANSITION",
      details: {
        currentStatus: existingProduct.status,
        productId: existingProduct.id,
        requestedStatus: input.status
      }
    });
  }

  if (existingProduct.status === input.status) {
    throw new HttpError(409, "The product status changed elsewhere. Refresh and try again.", {
      code: "INVALID_PRODUCT_STATUS_TRANSITION",
      details: {
        currentStatus: existingProduct.status,
        productId: existingProduct.id,
        requestedStatus: input.status
      }
    });
  }

  if (
    (existingProduct.status === "ACTIVE" && input.status !== "INACTIVE") ||
    (existingProduct.status === "INACTIVE" && input.status !== "ACTIVE")
  ) {
    throw new HttpError(409, "The product status changed elsewhere. Refresh and try again.", {
      code: "INVALID_PRODUCT_STATUS_TRANSITION",
      details: {
        currentStatus: existingProduct.status,
        productId: existingProduct.id,
        requestedStatus: input.status
      }
    });
  }

  const updateResult = await prisma.product.updateMany({
    data: {
      status: input.status
    },
    where: {
      id: existingProduct.id,
      status: existingProduct.status
    }
  });

  if (updateResult.count !== 1) {
    throw new HttpError(409, "The product status changed elsewhere. Refresh and try again.", {
      code: "INVALID_PRODUCT_STATUS_TRANSITION",
      details: {
        currentStatus: existingProduct.status,
        productId: existingProduct.id,
        requestedStatus: input.status
      }
    });
  }

  const updatedProduct = await prisma.product.findUnique({
    include: productInclude,
    where: {
      id: existingProduct.id
    }
  });

  if (!updatedProduct) {
    throw new HttpError(404, "Product not found.", {
      code: "PRODUCT_NOT_FOUND"
    });
  }

  return asProductSummary(updatedProduct);
}

export async function getProductForLookup(barcode: string): Promise<ProductSummary> {
  const product = await prisma.product.findUnique({
    include: productInclude,
    where: {
      barcode
    }
  });

  if (!product) {
    throw new HttpError(404, "Product not found.", {
      code: "PRODUCT_NOT_FOUND"
    });
  }

  return asProductSummary(product);
}

export function summarizeProductStock(product: ProductSummary) {
  const currentQuantity = product.inventory.currentQuantity;
  const stockStatus = computeStockStatus(currentQuantity, product.reorderLevel);

  return {
    currentQuantity,
    stockStatus
  };
}

export async function listCategories() {
  const categories = await prisma.category.findMany({
    orderBy: [
      {
        name: "asc"
      }
    ],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      isActive: true
    }
  });

  return categories;
}

export async function createCategory(input: {
  description?: string | null;
  name: string;
  slug?: string | null;
}) {
  const name = normalizeWhitespace(input.name);
  if (!name) {
    throw new HttpError(400, "Category name is required.", {
      code: "INVALID_CATEGORY_REQUEST"
    });
  }

  const description =
    input.description === undefined || input.description === null
      ? undefined
      : normalizeOptionalString(input.description);
  const slug = buildCategorySlug(name, input.slug ?? undefined);

  await detectDuplicateCategoryName(name);
  await detectDuplicateCategorySlug(slug);

  try {
    const category = await prisma.category.create({
      data: {
        description,
        name,
        slug
      }
    });

    return serializeCategory(category);
  } catch (error) {
    if (isKnownPrismaError(error) && error.code === "P2002") {
      const fields = Array.isArray(error.meta?.target) ? error.meta?.target : [];

      if (fields.includes("name")) {
        throwDuplicateCategoryError("name");
      }

      if (fields.includes("slug")) {
        throwDuplicateCategoryError("slug");
      }
    }

    throw error;
  }
}
