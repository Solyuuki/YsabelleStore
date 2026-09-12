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
    receivedQuantity: z.coerce.number().int().min(1).max(1_000_000),
    batchCode: z.string().trim().min(1).max(80),
    expiresAt: z.coerce.date().nullable().optional(),
    noExpiration: z.boolean().default(false),
    reason: nullableText(255).optional()
  })
  .superRefine((line, context) => {
    if (line.noExpiration && line.expiresAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "An expiry date cannot be supplied when noExpiration is true.",
        path: ["expiresAt"]
      });
    }

    if (!line.noExpiration && !line.expiresAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose an expiry date or explicitly mark the delivery line as no expiration.",
        path: ["expiresAt"]
      });
    }
  });

export const completeBulkDeliverySchema = z.object({
  sourceType: z.enum(["SPREADSHEET", "PDF", "MANUAL"]),
  sourceFileName: nullableText(255).optional(),
  rows: z.array(bulkDeliveryLineSchema).min(1).max(1000)
});

export type CompleteBulkDeliveryRequest = z.infer<typeof completeBulkDeliverySchema>;
