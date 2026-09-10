import { z } from "zod";

export const productBarcodeProductIdParamSchema = z.object({
  productId: z.string().trim().min(1).max(191)
});

export const productBarcodeIdParamSchema = z.object({
  productId: z.string().trim().min(1).max(191),
  barcodeId: z.string().trim().min(1).max(191)
});

export const registerProductBarcodeSchema = z.object({
  barcode: z.string().trim().min(1).max(80),
  makePrimary: z.boolean().optional()
});

export const receivingBarcodeEnrollmentSchema = z.object({
  barcode: z.string().trim().min(1).max(80),
  confirmed: z.boolean(),
  sourceReference: z.string().trim().min(1).max(191).optional()
});
