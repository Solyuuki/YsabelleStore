import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().url().default("http://localhost:5173"),
  JWT_SECRET: z.string().optional(),
  DATABASE_URL: z.string().url().optional()
});

export const env = envSchema.parse(process.env);
