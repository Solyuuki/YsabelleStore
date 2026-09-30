import { z } from "zod";

export const deliveryStatusSchema = z.enum([
  "ORDER_PLACED",
  "PREPARING",
  "READY_FOR_DELIVERY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "DELIVERY_FAILED",
  "CANCELLED"
]);

export const deliveryTicketParamsSchema = z.object({
  orderId: z.string().trim().min(1).max(191)
});

export const customerDeliveryParamsSchema = z.object({
  orderNumber: z.string().trim().min(1).max(80)
});

export const deliveryListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: deliveryStatusSchema.optional(),
  paymentMethod: z.enum(["CASH_ON_DELIVERY", "PAYMONGO"]).optional(),
  search: z.string().trim().max(120).optional()
});

export const deliveryTransitionSchema = z.object({
  targetStatus: z.enum([
    "PREPARING",
    "READY_FOR_DELIVERY",
    "OUT_FOR_DELIVERY",
    "DELIVERY_FAILED",
    "CANCELLED"
  ]),
  courierProvider: z.string().trim().max(80).optional(),
  courierReference: z.string().trim().max(120).optional(),
  note: z.string().trim().max(255).optional()
});

export const codSettlementSchema = z.object({
  note: z.string().trim().max(255).optional()
});

export type DeliveryListQuery = z.infer<typeof deliveryListQuerySchema>;
export type DeliveryTransitionInput = z.infer<typeof deliveryTransitionSchema>;
export type CodSettlementInput = z.infer<typeof codSettlementSchema>;
