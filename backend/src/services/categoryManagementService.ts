import { Prisma } from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import {
  normalizeOptionalString,
  normalizeSlug,
  normalizeWhitespace
} from "../utils/normalizers.js";
import { buildPaginationMeta } from "../utils/pagination.js";
import type {
  CreateCategoryRequest,
  ListCategoriesQuery,
  UpdateCategoryRequest
} from "../validators/category.validators.js";

function categorySlug(name: string, slug?: string | null) {
  const normalized = normalizeSlug(slug?.trim() || name);
  if (!normalized) {
    throw new HttpError(400, "Category slug could not be derived.", {
      code: "INVALID_CATEGORY_SLUG"
    });
  }
  return normalized.slice(0, 140);
}

function duplicateCategory(field: "name" | "slug"): never {
  throw new HttpError(409, "Category already exists.", {
    code: "CATEGORY_ALREADY_EXISTS",
    details: { field }
  });
}

function isKnownPrismaError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

async function assertUniqueCategoryIdentity(input: {
  categoryId?: string;
  name?: string;
  slug?: string;
}) {
  const [nameMatch, slugMatch] = await Promise.all([
    input.name
      ? prisma.category.findUnique({ select: { id: true }, where: { name: input.name } })
      : Promise.resolve(null),
    input.slug
      ? prisma.category.findUnique({ select: { id: true }, where: { slug: input.slug } })
      : Promise.resolve(null)
  ]);

  if (nameMatch && nameMatch.id !== input.categoryId) duplicateCategory("name");
  if (slugMatch && slugMatch.id !== input.categoryId) duplicateCategory("slug");
}

const managedCategorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  isActive: true,
  recordSource: true,
  dataQualityStatus: true,
  isStorefrontVisible: true,
  activeCoverAssetId: true,
  coverStatus: true,
  coverPosition: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { products: true } }
} satisfies Prisma.CategorySelect;

type ManagedCategoryRecord = Prisma.CategoryGetPayload<{
  select: typeof managedCategorySelect;
}>;

function serializeManagedCategory(category: ManagedCategoryRecord) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    isActive: category.isActive,
    recordSource: category.recordSource,
    dataQualityStatus: category.dataQualityStatus,
    isStorefrontVisible: category.isStorefrontVisible,
    activeCoverAssetId: category.activeCoverAssetId,
    coverStatus: category.coverStatus,
    coverPosition: category.coverPosition,
    productCount: category._count.products,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt
  };
}

function buildCategoryWhere(query: ListCategoriesQuery): Prisma.CategoryWhereInput {
  const search = query.search?.trim();

  return {
    dataQualityStatus: { not: "REJECTED" },
    recordSource: { not: "TEST_FIXTURE" },
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { slug: { contains: search } },
            { description: { contains: search } }
          ]
        }
      : {}),
    ...(query.status === "ACTIVE"
      ? { isActive: true }
      : query.status === "INACTIVE"
        ? { isActive: false }
        : {}),
    ...(query.visibility === "VISIBLE"
      ? { isStorefrontVisible: true }
      : query.visibility === "HIDDEN"
        ? { isStorefrontVisible: false }
        : {}),
    ...(query.coverStatus !== "ALL" ? { coverStatus: query.coverStatus } : {})
  };
}

function buildCategoryOrderBy(
  query: ListCategoriesQuery
): Prisma.CategoryOrderByWithRelationInput[] {
  if (query.sortBy === "productCount") {
    return [{ products: { _count: query.sortOrder } }, { name: "asc" }, { id: "asc" }];
  }
  if (query.sortBy === "name") {
    return [{ name: query.sortOrder }, { id: "asc" }];
  }
  return [{ updatedAt: query.sortOrder }, { name: "asc" }, { id: "asc" }];
}

export async function listManagedCategories(query: ListCategoriesQuery) {
  const where = buildCategoryWhere(query);
  const totalItems = await prisma.category.count({ where });
  const totalPages = totalItems === 0 ? 1 : Math.max(1, Math.ceil(totalItems / query.pageSize));
  const page = Math.min(query.page, totalPages);

  const categories = await prisma.category.findMany({
    orderBy: buildCategoryOrderBy(query),
    select: managedCategorySelect,
    skip: (page - 1) * query.pageSize,
    take: query.pageSize,
    where
  });

  return {
    items: categories.map(serializeManagedCategory),
    meta: buildPaginationMeta(totalItems, { page, pageSize: query.pageSize })
  };
}

export async function getManagedCategory(categoryId: string) {
  const category = await prisma.category.findFirst({
    select: managedCategorySelect,
    where: {
      id: categoryId,
      dataQualityStatus: { not: "REJECTED" },
      recordSource: { not: "TEST_FIXTURE" }
    }
  });

  if (!category) {
    throw new HttpError(404, "Category was not found.", { code: "CATEGORY_NOT_FOUND" });
  }
  return serializeManagedCategory(category);
}

export async function createManagedCategory(input: CreateCategoryRequest) {
  const name = normalizeWhitespace(input.name);
  const slug = categorySlug(name, input.slug);
  const description =
    input.description === undefined ? undefined : normalizeOptionalString(input.description);

  await assertUniqueCategoryIdentity({ name, slug });

  try {
    const category = await prisma.category.create({
      data: {
        description,
        name,
        slug,
        recordSource: "CATALOG",
        dataQualityStatus: "APPROVED",
        isStorefrontVisible: true,
        coverStatus: "MISSING",
        coverPosition: "CENTER"
      },
      select: managedCategorySelect
    });
    return serializeManagedCategory(category);
  } catch (error) {
    if (isKnownPrismaError(error) && error.code === "P2002") {
      const fields = Array.isArray(error.meta?.target) ? error.meta?.target : [];
      if (fields.includes("name")) duplicateCategory("name");
      if (fields.includes("slug")) duplicateCategory("slug");
    }
    throw error;
  }
}

export async function updateManagedCategory(categoryId: string, input: UpdateCategoryRequest) {
  const existing = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!existing) {
    throw new HttpError(404, "Category was not found.", { code: "CATEGORY_NOT_FOUND" });
  }

  const name = input.name ? normalizeWhitespace(input.name) : existing.name;
  const slug = input.slug !== undefined ? categorySlug(name, input.slug) : existing.slug;
  const description =
    input.description === undefined
      ? undefined
      : input.description === null
        ? null
        : (normalizeOptionalString(input.description) ?? null);

  await assertUniqueCategoryIdentity({ categoryId, name, slug });

  try {
    const category = await prisma.category.update({
      data: {
        ...(input.name !== undefined ? { name } : {}),
        ...(input.slug !== undefined ? { slug } : {}),
        ...(input.description !== undefined ? { description } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.isStorefrontVisible !== undefined
          ? { isStorefrontVisible: input.isStorefrontVisible }
          : {}),
        ...(input.coverPosition !== undefined ? { coverPosition: input.coverPosition } : {})
      },
      select: managedCategorySelect,
      where: { id: categoryId }
    });
    return serializeManagedCategory(category);
  } catch (error) {
    if (isKnownPrismaError(error) && error.code === "P2002") {
      const fields = Array.isArray(error.meta?.target) ? error.meta?.target : [];
      if (fields.includes("name")) duplicateCategory("name");
      if (fields.includes("slug")) duplicateCategory("slug");
    }
    throw error;
  }
}
