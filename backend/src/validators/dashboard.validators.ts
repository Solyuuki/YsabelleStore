import { z } from "zod";

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const datePattern = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;

export const dashboardSalesCalendarQuerySchema = z.object({
  month: z.string().regex(monthPattern, "month must use YYYY-MM format")
});

export const dashboardSalesDayQuerySchema = z.object({
  date: z.string().regex(datePattern, "date must use YYYY-MM-DD format")
});
