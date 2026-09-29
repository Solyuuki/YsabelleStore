import { z } from "zod";

import { SUPPORT_TICKET_CATEGORIES, SUPPORT_TICKET_STATUSES } from "../types/customerSupport.js";

export const supportTicketCategorySchema = z.enum(SUPPORT_TICKET_CATEGORIES);
export const supportTicketStatusSchema = z.enum(SUPPORT_TICKET_STATUSES);

export const customerSupportTicketCreateSchema = z
  .object({
    customerName: z.string().trim().min(2).max(120),
    customerEmail: z.string().trim().email().max(191),
    customerPhone: z.string().trim().min(7).max(40).optional().or(z.literal("")),
    category: supportTicketCategorySchema,
    orderNumber: z.string().trim().min(1).max(80).optional().or(z.literal("")),
    subject: z.string().trim().min(4).max(160),
    message: z.string().trim().min(10).max(5000)
  })
  .strict();

export const supportTicketIdParamsSchema = z
  .object({
    ticketId: z.string().trim().min(1).max(191)
  })
  .strict();

export const supportTicketListQuerySchema = z
  .object({
    status: supportTicketStatusSchema.optional(),
    category: supportTicketCategorySchema.optional(),
    search: z.string().trim().max(120).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25)
  })
  .strict();

export const supportTicketStatusUpdateSchema = z
  .object({
    status: supportTicketStatusSchema
  })
  .strict();

export const supportTicketReplySchema = z
  .object({
    message: z.string().trim().min(1).max(5000)
  })
  .strict();

export type CustomerSupportTicketCreateInput = z.infer<typeof customerSupportTicketCreateSchema>;
export type SupportTicketListQuery = z.infer<typeof supportTicketListQuerySchema>;
export type SupportTicketStatusUpdateInput = z.infer<typeof supportTicketStatusUpdateSchema>;
export type SupportTicketReplyInput = z.infer<typeof supportTicketReplySchema>;
