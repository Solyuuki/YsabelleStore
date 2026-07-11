import { z } from "zod";

export const posProductSearchQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

export const posCheckoutItemSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.number().int().positive().max(9999)
});

export const posCheckoutRequestSchema = z.object({
  items: z.array(posCheckoutItemSchema).min(1),
  notes: z.string().trim().max(255).optional(),
  paymentMethod: z.literal("CASH").default("CASH")
});

export const salesListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional()
});

export type PosProductSearchQuery = z.infer<typeof posProductSearchQuerySchema>;
export type PosCheckoutItemInput = z.infer<typeof posCheckoutItemSchema>;
export type PosCheckoutRequest = z.infer<typeof posCheckoutRequestSchema>;
export type SalesListQuery = z.infer<typeof salesListQuerySchema>;
