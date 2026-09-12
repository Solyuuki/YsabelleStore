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

const optionalSearchSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return value;
}, z.string().max(160).optional());

export const restockOrderStatusSchema = z.enum([
  "DRAFT",
  "APPROVED",
  "AWAITING_DELIVERY",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED"
]);

const optionalRestockStatusesSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const statuses = [
      ...new Set(
        value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      )
    ];
    return statuses.length > 0 ? statuses : undefined;
  }
  return value;
}, z.array(restockOrderStatusSchema).min(1).max(restockOrderStatusSchema.options.length).optional());

export const restockRecommendationSourceSchema = z.enum([
  "SARIMA",
  "LOW_STOCK",
  "TARGET_STOCK",
  "MANUAL"
]);

export const restockOrderIdParamSchema = z.object({
  orderId: z.string().trim().min(1).max(191)
});

export const restockRecommendationIdParamSchema = z.object({
  recommendationId: z.string().trim().min(1).max(191)
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

export const advanceRestockOrderSchema = z.object({
  expectedVersion: z.coerce.number().int().min(0)
});

export const cancelRestockOrderSchema = z.object({
  expectedVersion: z.coerce.number().int().min(0),
  reason: z.string().trim().min(3).max(500)
});

const restockReceiptLineSchema = z
  .object({
    lineId: z.string().trim().min(1).max(191),
    deliveredQuantity: z.coerce.number().int().min(0).max(1_000_000),
    damagedQuantity: z.coerce.number().int().min(0).max(1_000_000).default(0),
    acceptedQuantity: z.coerce.number().int().min(0).max(1_000_000),
    batchCode: optionalTextSchema(80),
    expiresAt: z.coerce.date().nullable().optional(),
    noExpiration: z.boolean().default(false),
    scannedBarcode: optionalTextSchema(80),
    confirmNewBarcode: z.boolean().optional(),
    confirmOverDelivery: z.boolean().optional(),
    unitCost: z.coerce.number().positive().max(1_000_000_000).optional()
  })
  .superRefine((line, context) => {
    if (line.damagedQuantity > line.deliveredQuantity) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Damaged quantity cannot exceed delivered quantity.",
        path: ["damagedQuantity"]
      });
    }

    if (line.acceptedQuantity > line.deliveredQuantity - line.damagedQuantity) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Accepted quantity cannot exceed delivered quantity after damaged units.",
        path: ["acceptedQuantity"]
      });
    }

    if (line.acceptedQuantity > 0 && !line.batchCode) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Accepted stock requires a batch code.",
        path: ["batchCode"]
      });
    }

    if (line.acceptedQuantity > 0 && !line.noExpiration && !line.expiresAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose an expiration date or explicitly mark the batch as having no expiration.",
        path: ["expiresAt"]
      });
    }

    if (line.noExpiration && line.expiresAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Do not provide an expiration date when No expiration is selected.",
        path: ["expiresAt"]
      });
    }
  });

export const receiveRestockOrderSchema = z
  .object({
    expectedVersion: z.coerce.number().int().min(0),
    lines: z.array(restockReceiptLineSchema).min(1).max(500)
  })
  .superRefine((input, context) => {
    if (new Set(input.lines.map((line) => line.lineId)).size !== input.lines.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A restock line can appear only once in a receipt.",
        path: ["lines"]
      });
    }

    if (!input.lines.some((line) => line.deliveredQuantity > 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Record at least one delivered unit before completing a receipt.",
        path: ["lines"]
      });
    }
  });

export const restockOrderListQuerySchema = z.object({
  search: optionalSearchSchema,
  status: restockOrderStatusSchema.optional(),
  statuses: optionalRestockStatusesSchema,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export const restockPlanningQuerySchema = z.object({
  search: optionalSearchSchema,
  includeZero: z
    .preprocess((value) => {
      if (value === "true") return true;
      if (value === "false") return false;
      return value;
    }, z.boolean())
    .default(false),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export const dismissRestockRecommendationSchema = z.object({
  reason: z.string().trim().min(3).max(500)
});

export type CreateRestockOrderRequest = z.infer<typeof createRestockOrderSchema>;
export type ReplaceRestockOrderLinesRequest = z.infer<typeof replaceRestockOrderLinesSchema>;
export type UpdateRestockOrderRequest = z.infer<typeof updateRestockOrderSchema>;
export type ApproveRestockOrderRequest = z.infer<typeof approveRestockOrderSchema>;
export type AdvanceRestockOrderRequest = z.infer<typeof advanceRestockOrderSchema>;
export type CancelRestockOrderRequest = z.infer<typeof cancelRestockOrderSchema>;
export type ReceiveRestockOrderRequest = z.infer<typeof receiveRestockOrderSchema>;
export type RestockOrderListQuery = z.infer<typeof restockOrderListQuerySchema>;
export type RestockPlanningQuery = z.infer<typeof restockPlanningQuerySchema>;
export type DismissRestockRecommendationRequest = z.infer<
  typeof dismissRestockRecommendationSchema
>;
