import { z } from "zod";

import { productStatusSchema } from "./product.validators.js";

const optionalTextSchema = (maxLength: number) =>
  z.preprocess((value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();

      return trimmed.length > 0 ? trimmed : undefined;
    }

    return value;
  }, z.string().max(maxLength).optional());

export const inventoryMovementTypeSchema = z.enum([
  "STOCK_IN",
  "SALE",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "RETURN_IN",
  "RETURN_OUT",
  "DAMAGE",
  "EXPIRED",
  "INITIAL_STOCK"
]);

export const inventoryIdParamSchema = z.object({
  productId: z.string().trim().min(1).max(191)
});

export const movementIdParamSchema = z.object({
  productId: z.string().trim().min(1).max(191)
});

export const lookupInventoryQuerySchema = z.object({
  barcode: z.string().trim().min(1).max(80)
});

export const inventoryListQuerySchema = z.object({
  search: optionalTextSchema(160),
  categoryId: optionalTextSchema(191),
  category: optionalTextSchema(140),
  productStatus: productStatusSchema.optional(),
  stockStatus: z.enum(["ALL", "IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]).default("ALL"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum([
      "productName",
      "sku",
      "barcode",
      "quantityOnHand",
      "reorderLevel",
      "lastStockUpdatedAt",
      "createdAt",
      "updatedAt"
    ])
    .default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
});

export const stockInSchema = z.object({
  quantity: z.coerce.number().int().min(1),
  reason: optionalTextSchema(255),
  referenceType: optionalTextSchema(80),
  referenceId: optionalTextSchema(191)
});

export const stockAdjustSchema = z.object({
  movementType: z.enum(["ADJUSTMENT_IN", "ADJUSTMENT_OUT"]),
  quantity: z.coerce.number().int().min(1),
  reason: z.string().trim().min(1).max(255),
  referenceType: optionalTextSchema(80),
  referenceId: optionalTextSchema(191)
});

const deductionLineItemSchema = z.object({
  productId: z.string().trim().min(1).max(191),
  quantity: z.coerce.number().int().min(1)
});

export const stockDeductionSchema = z.object({
  lineItems: z.array(deductionLineItemSchema).min(1),
  referenceType: optionalTextSchema(80),
  referenceId: optionalTextSchema(191),
  reason: optionalTextSchema(255)
});

export const movementHistoryQuerySchema = z.object({
  movementType: inventoryMovementTypeSchema.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export type InventoryListQuery = z.infer<typeof inventoryListQuerySchema>;
export type StockInRequest = z.infer<typeof stockInSchema>;
export type StockAdjustRequest = z.infer<typeof stockAdjustSchema>;
export type StockDeductionRequest = z.infer<typeof stockDeductionSchema>;
export type MovementHistoryQuery = z.infer<typeof movementHistoryQuerySchema>;
