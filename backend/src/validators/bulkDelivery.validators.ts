import { z } from "zod";

const nullableText = (maxLength: number) =>
  z.preprocess((value) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, z.string().max(maxLength).nullable());

const bulkDeliveryLineSchema = z
  .object({
    productId: z.string().trim().min(1).max(191),
    restockOrderLineId: nullableText(191).optional(),
    receivedQuantity: z.coerce.number().int().min(0).max(1_000_000),
    damagedQuantity: z.coerce.number().int().min(0).max(1_000_000).default(0),
    damageReason: nullableText(240).optional(),
    acceptedQuantity: z.coerce.number().int().min(0).max(1_000_000).optional(),
    batchCode: nullableText(80).optional(),
    expiresAt: z.coerce.date().nullable().optional(),
    noExpiration: z.boolean().default(false),
    confirmOverDelivery: z.boolean().optional(),
    reason: nullableText(255).optional()
  })
  .superRefine((line, context) => {
    if (line.damagedQuantity > line.receivedQuantity) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Damaged quantity cannot exceed delivered quantity.",
        path: ["damagedQuantity"]
      });
    }

    if (line.damagedQuantity > 0 && !line.damageReason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Damaged units require a return reason.",
        path: ["damageReason"]
      });
    }

    const acceptedQuantity =
      line.acceptedQuantity ?? Math.max(0, line.receivedQuantity - line.damagedQuantity);

    if (acceptedQuantity > line.receivedQuantity - line.damagedQuantity) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Accepted quantity cannot exceed delivered quantity after damaged units.",
        path: ["acceptedQuantity"]
      });
    }

    if (acceptedQuantity > 0 && !line.batchCode) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Accepted stock requires a batch or lot code.",
        path: ["batchCode"]
      });
    }

    if (acceptedQuantity > 0 && !line.noExpiration && !line.expiresAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose an expiry date or explicitly mark the line as no expiration.",
        path: ["expiresAt"]
      });
    }

    if (line.noExpiration && line.expiresAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Do not provide an expiry date when noExpiration is true.",
        path: ["expiresAt"]
      });
    }
  });

export const completeBulkDeliverySchema = z
  .object({
    sourceType: z.enum(["SPREADSHEET", "PDF", "MANUAL"]),
    sourceFileName: nullableText(255).optional(),
    restockOrderId: nullableText(191).optional(),
    expectedOrderVersion: z.coerce.number().int().min(0).optional(),
    rows: z.array(bulkDeliveryLineSchema).min(1).max(1000)
  })
  .superRefine((input, context) => {
    const linkedToRestock = Boolean(input.restockOrderId);

    if (linkedToRestock && input.expectedOrderVersion === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A linked Restock Order requires its expected version.",
        path: ["expectedOrderVersion"]
      });
    }

    if (!linkedToRestock && input.expectedOrderVersion !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "expectedOrderVersion is valid only when a Restock Order is linked.",
        path: ["expectedOrderVersion"]
      });
    }

    if (linkedToRestock && input.rows.some((row) => !row.restockOrderLineId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Every linked delivery row must identify its Restock Order line.",
        path: ["rows"]
      });
    }

    if (!linkedToRestock && input.rows.some((row) => row.restockOrderLineId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Restock Order line identifiers require a linked Restock Order.",
        path: ["rows"]
      });
    }

    if (!input.rows.some((row) => row.receivedQuantity > 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Record at least one delivered unit before completing the delivery session.",
        path: ["rows"]
      });
    }

    if (!linkedToRestock) {
      input.rows.forEach((row, index) => {
        if (row.receivedQuantity < 1) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Standalone delivery rows must contain received stock.",
            path: ["rows", index, "receivedQuantity"]
          });
        }

        if (row.damagedQuantity > 0) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Damaged or returnable units must be linked to a Restock Order so the supplier return report remains auditable.",
            path: ["rows", index, "damagedQuantity"]
          });
        }

        if (
          row.acceptedQuantity !== undefined &&
          row.acceptedQuantity !== row.receivedQuantity
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "Standalone inventory delivery rows accept the full received quantity. Link a Restock Order to record rejected or damaged units.",
            path: ["rows", index, "acceptedQuantity"]
          });
        }
      });
    }
  });

export type CompleteBulkDeliveryRequest = z.infer<typeof completeBulkDeliverySchema>;
