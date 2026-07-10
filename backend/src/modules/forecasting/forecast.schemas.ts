import { z } from "zod";

export const forecastModelSchema = z.enum(["SARIMA", "SEASONAL_NAIVE", "MOVING_AVERAGE"]);
export const forecastStatusSchema = z.enum(["READY", "WARNING", "FAILED"]);

export const forecastListQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  category: z.string().trim().max(120).optional(),
  model: z.union([forecastModelSchema, z.literal("ALL")]).default("ALL"),
  status: z.union([forecastStatusSchema, z.literal("ALL")]).default("ALL"),
  sortBy: z
    .enum([
      "productId",
      "productName",
      "category",
      "model",
      "status",
      "totalForecast2026",
      "growthVersus2025"
    ])
    .default("productId"),
  sortDirection: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(50).default(20)
});

export const forecastGenerateBodySchema = z
  .object({
    force: z.boolean().optional().default(false)
  })
  .default({ force: false });
