import { z } from "zod";

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

export const productIdParamSchema = z.object({
  id: z.string().trim().min(1).max(191)
});

export const createProductSchema = z.object({
  name: z.string().trim().min(1).max(160),
  sku: z.string().trim().min(1).max(80),
  barcode: optionalTextSchema(80),
  categoryId: z.string().trim().min(1).max(191),
  unit: productUnitSchema.default("PIECE"),
  costPrice: moneyStringSchema,
  sellingPrice: moneyStringSchema,
  reorderLevel: z.coerce.number().int().min(0).default(0),
  targetStockLevel: z.coerce.number().int().min(0).default(0),
  status: productStatusSchema.optional(),
  description: optionalTextSchema(255)
});

export const updateProductSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  sku: z.string().trim().min(1).max(80).optional(),
  barcode: optionalTextSchema(80),
  categoryId: z.string().trim().min(1).max(191).optional(),
  unit: productUnitSchema.optional(),
  costPrice: moneyStringSchema.optional(),
  sellingPrice: moneyStringSchema.optional(),
  reorderLevel: z.coerce.number().int().min(0).optional(),
  targetStockLevel: z.coerce.number().int().min(0).optional(),
  status: productStatusSchema.optional(),
  description: optionalTextSchema(255)
});

export const deactivateProductSchema = z.object({
  status: z.enum(["INACTIVE", "DISCONTINUED"])
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
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
