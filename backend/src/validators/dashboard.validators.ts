import { z } from "zod";

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const datePattern = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;

export const dashboardSalesCalendarQuerySchema = z.object({
  month: z.string().regex(monthPattern, "month must use YYYY-MM format")
});

export const dashboardSalesDayQuerySchema = z.object({
  date: z.string().regex(datePattern, "date must use YYYY-MM-DD format")
});

export const dashboardSalesTargetParamsSchema = z.object({
  date: z.string().regex(datePattern, "date must use YYYY-MM-DD format")
});

export const dashboardSalesTargetBodySchema = z.object({
  targetAmount: z
    .union([z.number(), z.string(), z.null()])
    .transform((value) => (value === null ? null : Number(value)))
    .refine(
      (value) => value === null || (Number.isFinite(value) && value >= 0 && value <= 9_999_999_999.99),
      "targetAmount must be null or a non-negative amount within supported currency limits"
    )
});
