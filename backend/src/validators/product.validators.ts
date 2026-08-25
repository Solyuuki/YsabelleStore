import { z } from "zod";

import { isSupportedCatalogImageUrl } from "../utils/catalogImage.js";

const moneyStringSchema = z.preprocess(
  (value) => {
    if (typeof value === "number") {
      return value.toString();
    }

    if (typeof value === "string") {
      return value.trim();
    }

    return value;
  },
  z.string().regex(/^\d+(?:\.\d{1,2})?$/, "Money values must use up to two decimal places.")
);

const optionalTextSchema = (maxLength: number) =>
  z.preprocess((value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();

      return trimmed.length > 0 ? trimmed : undefined;
    }

    return value;
  }, z.string().max(maxLength).optional());

const nullableOptionalTextSchema = (maxLength: number) =>
  z.preprocess((value) => {
    if (value === null) return null;
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    return value;
  }, z.string().max(maxLength).nullable().optional());

const optionalCatalogImageUrlSchema = z.preprocess(
  (value) => {
    if (value === null) return null;
    if (typeof value !== "string") return value;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  },
  z
    .string()
    .max(2048)
    .refine(isSupportedCatalogImageUrl, {
      message: "Product images must use an HTTPS URL or a root-relative local asset path."
    })
    .nullable()
    .optional()
);

export const productUnitSchema = z.enum([
  "PIECE",
  "PACK",
  "BOX",
  "BOTTLE",
  "SACHET",
  "KILOGRAM",
  "GRAM",
  "LITER",
  "MILLILITER"
]);

export const productStatusSchema = z.enum(["ACTIVE", "INACTIVE", "DISCONTINUED"]);
export const catalogQualityStatusSchema = z.enum(["APPROVED", "NEEDS_REVIEW", "REJECTED"]);
export const productSizeUnitSchema = z.enum(["MILLILITER", "LITER", "GRAM", "KILOGRAM", "PIECE"]);

export const productIdParamSchema = z.object({
  id: z.string().trim().min(1).max(191)
});

export const createProductSchema = z.object({
  name: z.string().trim().min(1).max(160),
  sku: z.string().trim().min(1).max(80),
  barcode: nullableOptionalTextSchema(80),
  categoryId: z.string().trim().min(1).max(191),
  unit: productUnitSchema.default("PIECE"),
  costPrice: moneyStringSchema,
  sellingPrice: moneyStringSchema,
  reorderLevel: z.coerce.number().int().min(0).default(0),
  targetStockLevel: z.coerce.number().int().min(0).default(0),
  status: productStatusSchema.optional(),
  description: nullableOptionalTextSchema(255),
  imageUrl: optionalCatalogImageUrlSchema,
  brand: nullableOptionalTextSchema(120),
  variant: nullableOptionalTextSchema(120),
  sizeValue: z.coerce.number().positive().max(9999999).optional(),
  sizeUnit: productSizeUnitSchema.optional(),
  dataQualityStatus: catalogQualityStatusSchema.optional(),
  isStorefrontVisible: z.boolean().optional()
});

export const updateProductSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  sku: z.string().trim().min(1).max(80).optional(),
  barcode: nullableOptionalTextSchema(80),
  categoryId: z.string().trim().min(1).max(191).optional(),
  unit: productUnitSchema.optional(),
  costPrice: moneyStringSchema.optional(),
  sellingPrice: moneyStringSchema.optional(),
  reorderLevel: z.coerce.number().int().min(0).optional(),
  targetStockLevel: z.coerce.number().int().min(0).optional(),
  status: productStatusSchema.optional(),
  description: nullableOptionalTextSchema(255),
  imageUrl: optionalCatalogImageUrlSchema,
  brand: nullableOptionalTextSchema(120),
  variant: nullableOptionalTextSchema(120),
  sizeValue: z.coerce.number().positive().max(9999999).nullable().optional(),
  sizeUnit: productSizeUnitSchema.nullable().optional(),
  dataQualityStatus: catalogQualityStatusSchema.optional(),
  isStorefrontVisible: z.boolean().optional()
});

export const deactivateProductSchema = z.object({
  status: productStatusSchema
});

export const productAvailabilityStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"])
});

export const listProductsQuerySchema = z.object({
  search: optionalTextSchema(160),
  sku: optionalTextSchema(80),
  barcode: optionalTextSchema(80),
  categoryId: optionalTextSchema(191),
  category: optionalTextSchema(140),
  status: productStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(["name", "sku", "barcode", "sellingPrice", "createdAt", "updatedAt"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("asc")
});

export type CreateProductRequest = z.infer<typeof createProductSchema>;
export type UpdateProductRequest = z.infer<typeof updateProductSchema>;
export type DeactivateProductRequest = z.infer<typeof deactivateProductSchema>;
export type ProductAvailabilityStatusRequest = z.infer<typeof productAvailabilityStatusSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
