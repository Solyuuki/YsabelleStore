import { z } from "zod";

export const forecastListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  category: z.string().trim().max(120).optional(),
  sortBy: z
    .enum([
      "productId",
      "productName",
      "category",
      "totalForecast2026",
      "growthVersus2025",
      "currentMonthForecastQuantity",
      "recentHistoricalSalesTotal",
      "twelveMonthForecastTotal"
    ])
    .default("productId"),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

export const forecastGenerateBodySchema = z
  .object({
    force: z.boolean().optional().default(false)
  })
  .default({ force: false });

export const forecastDetailQuerySchema = z.object({
  batchId: z.string().trim().min(1).max(191).optional()
});
