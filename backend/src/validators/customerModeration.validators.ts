import { z } from "zod";

const customerAdminPaginationQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

export const customerAdminListQuerySchema = customerAdminPaginationQuerySchema.extend({
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "BANNED"]).optional()
});

export const customerAdminReviewQuerySchema = customerAdminPaginationQuerySchema.extend({
  status: z.enum(["VISIBLE", "HIDDEN", "REMOVED"]).optional()
});

export const customerAdminParamsSchema = z.object({
  id: z.string().trim().min(1).max(191)
});

export const customerAdminStatusMutationSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]),
  reason: z.string().trim().min(3).max(500)
});

export const customerAdminReviewMutationSchema = z.object({
  status: z.enum(["VISIBLE", "HIDDEN", "REMOVED"]),
  reason: z.string().trim().min(3).max(500)
});

export type CustomerAdminListQuery = z.infer<typeof customerAdminListQuerySchema>;
export type CustomerAdminReviewQuery = z.infer<typeof customerAdminReviewQuerySchema>;
export type CustomerAdminStatusMutation = z.infer<typeof customerAdminStatusMutationSchema>;
export type CustomerAdminReviewMutation = z.infer<typeof customerAdminReviewMutationSchema>;
