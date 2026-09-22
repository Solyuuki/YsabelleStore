import { z } from "zod";

export const customerCartItemSchema = z.object({
  productId: z.string().trim().min(1).max(191),
  quantity: z.number().int().min(1).max(999)
});

export const customerCartMergeSchema = z.object({
  items: z.array(customerCartItemSchema).max(100)
});

export const customerCartQuantitySchema = z.object({
  quantity: z.number().int().min(1).max(999)
});

export const customerCartProductParamsSchema = z.object({
  productId: z.string().trim().min(1).max(191)
});

export type CustomerCartItemInput = z.infer<typeof customerCartItemSchema>;
