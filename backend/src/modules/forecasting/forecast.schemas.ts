import { z } from "zod";

export const forecastListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  category: z.string().trim().max(120).optional(),
  sortBy: z
    .enum(["productId", "productName", "category", "totalForecast2026", "growthVersus2025"])
    .default("productId"),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(500).default(100)
});

export const forecastGenerateBodySchema = z
  .object({
    force: z.boolean().optional().default(false)
  })
  .default({ force: false });
