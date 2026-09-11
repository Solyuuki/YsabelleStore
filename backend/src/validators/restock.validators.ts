import { z } from "zod";

const optionalTextSchema = (maxLength: number) =>
  z.preprocess((value) => {
    if (value === null) return null;
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    return value;
  }, z.string().max(maxLength).nullable().optional());

export const restockOrderStatusSchema = z.enum([
  "DRAFT",
  "APPROVED",
  "AWAITING_DELIVERY",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED"
]);

export const restockRecommendationSourceSchema = z.enum([
  "SARIMA",
  "LOW_STOCK",
  "TARGET_STOCK",
  "MANUAL"
]);

export const restockOrderIdParamSchema = z.object({
  orderId: z.string().trim().min(1).max(191)
});

const restockDraftLineSchema = z
  .object({
    productId: z.string().trim().min(1).max(191),
    recommendationId: z.string().trim().min(1).max(191).nullable().optional(),
    recommendationSource: restockRecommendationSourceSchema.default("MANUAL"),
    recommendedQuantity: z.coerce.number().int().min(0).max(1_000_000).default(0),
    requestedQuantity: z.coerce.number().int().min(0).max(1_000_000),
    isSelected: z.boolean().default(true),
    ownerOverrideReason: optionalTextSchema(500),
    notes: optionalTextSchema(500)
  })
  .superRefine((line, context) => {
    if (line.isSelected && line.requestedQuantity < 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Selected restock lines require a requested quantity greater than zero.",
        path: ["requestedQuantity"]
      });
    }

    if (
      line.recommendationSource !== "MANUAL" &&
      line.requestedQuantity !== line.recommendedQuantity &&
      !line.ownerOverrideReason
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Changing an automated recommendation requires an owner override reason.",
        path: ["ownerOverrideReason"]
      });
    }
  });

const uniqueProductLines = <T extends { productId: string }>(lines: T[]) =>
  new Set(lines.map((line) => line.productId)).size === lines.length;

export const createRestockOrderSchema = z
  .object({
    notes: optionalTextSchema(1000),
    lines: z.array(restockDraftLineSchema).min(1).max(500)
  })
  .refine((input) => uniqueProductLines(input.lines), {
    message: "A product can appear only once in a restock order.",
    path: ["lines"]
  });

export const replaceRestockOrderLinesSchema = z
  .object({
    expectedVersion: z.coerce.number().int().min(0),
    lines: z.array(restockDraftLineSchema).min(1).max(500)
  })
  .refine((input) => uniqueProductLines(input.lines), {
    message: "A product can appear only once in a restock order.",
    path: ["lines"]
  });

export const updateRestockOrderSchema = z.object({
  expectedVersion: z.coerce.number().int().min(0),
  notes: optionalTextSchema(1000)
});

export const approveRestockOrderSchema = z.object({
  expectedVersion: z.coerce.number().int().min(0)
});

export const restockOrderListQuerySchema = z.object({
  status: restockOrderStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export type CreateRestockOrderRequest = z.infer<typeof createRestockOrderSchema>;
export type ReplaceRestockOrderLinesRequest = z.infer<typeof replaceRestockOrderLinesSchema>;
export type UpdateRestockOrderRequest = z.infer<typeof updateRestockOrderSchema>;
export type ApproveRestockOrderRequest = z.infer<typeof approveRestockOrderSchema>;
export type RestockOrderListQuery = z.infer<typeof restockOrderListQuerySchema>;
