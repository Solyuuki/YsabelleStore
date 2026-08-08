import { z } from "zod";

export const storefrontProductQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  category: z.string().trim().max(140).optional(),
  availability: z.enum(["all", "in-stock", "out-of-stock"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(24)
});

export const storefrontProductParamsSchema = z.object({
  id: z.string().trim().min(1).max(191)
});

export const storefrontOrderSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  customerEmail: z.string().trim().email().max(191).optional().or(z.literal("")),
  customerPhone: z.string().trim().min(7).max(40),
  notes: z.string().trim().max(255).optional(),
  fulfillmentMethod: z.literal("STORE_PICKUP"),
  paymentMethod: z.literal("CASH_ON_PICKUP"),
  items: z
    .array(
      z.object({
        productId: z.string().trim().min(1).max(191),
        quantity: z.number().int().positive().max(999)
      })
    )
    .min(1)
    .max(100)
});

export type StorefrontProductQuery = z.infer<typeof storefrontProductQuerySchema>;
export type StorefrontOrderInput = z.infer<typeof storefrontOrderSchema>;
