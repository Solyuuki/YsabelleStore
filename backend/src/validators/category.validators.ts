import { z } from "zod";

const trimmedString = (maxLength: number) =>
  z.preprocess((value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();

      return trimmed.length > 0 ? trimmed : "";
    }

    return value;
  }, z.string().min(1, "Category name is required.").max(maxLength));

const optionalTrimmedString = (maxLength: number) =>
  z.preprocess((value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();

      return trimmed.length > 0 ? trimmed : undefined;
    }

    return value;
  }, z.string().max(maxLength).optional());

export const createCategorySchema = z.object({
  name: trimmedString(120),
  slug: optionalTrimmedString(140),
  description: optionalTrimmedString(255)
});

export type CreateCategoryRequest = z.infer<typeof createCategorySchema>;

const categoryCoverStatusFilterSchema = z.enum([
  "ALL",
  "MISSING",
  "PROCESSING",
  "NEEDS_REVIEW",
  "READY",
  "FAILED"
]);
const categoryVisibilityFilterSchema = z.enum(["ALL", "VISIBLE", "HIDDEN"]);
const categoryStatusFilterSchema = z.enum(["ALL", "ACTIVE", "INACTIVE"]);
const categoryCoverPositionSchema = z.enum([
  "LEFT",
  "CENTER",
  "RIGHT",
  "TOP",
  "BOTTOM",
  "TOP_LEFT",
  "TOP_RIGHT",
  "BOTTOM_LEFT",
  "BOTTOM_RIGHT"
]);

const nullableOptionalTrimmedString = (maxLength: number) =>
  z.preprocess((value) => {
    if (value === null) return null;
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    return value;
  }, z.string().max(maxLength).nullable().optional());

export const listCategoriesQuerySchema = z.object({
  search: optionalTrimmedString(160),
  coverStatus: categoryCoverStatusFilterSchema.default("ALL"),
  visibility: categoryVisibilityFilterSchema.default("ALL"),
  status: categoryStatusFilterSchema.default("ALL"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["updatedAt", "name", "productCount"]).default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
});

export const categoryIdParamSchema = z.object({
  id: z.string().trim().min(1).max(191)
});

export const updateCategorySchema = z
  .object({
    name: trimmedString(120).optional(),
    slug: optionalTrimmedString(140),
    description: nullableOptionalTrimmedString(255),
    isActive: z.boolean().optional(),
    isStorefrontVisible: z.boolean().optional(),
    coverPosition: categoryCoverPositionSchema.optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one category field is required."
  });

export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
export type UpdateCategoryRequest = z.infer<typeof updateCategorySchema>;
