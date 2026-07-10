import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { z } from "zod";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);
const rootEnvPath = path.resolve(currentDirectory, "../../..", ".env");

loadEnv({ path: rootEnvPath });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(1).optional(),
  PYTHON_EXECUTABLE: z.string().min(1).default("python"),
  FORECAST_PROCESS_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  FORECAST_MAX_CONCURRENCY: z.coerce.number().int().positive().default(2),
  FORECAST_DEFAULT_HORIZON: z.coerce.number().int().positive().default(12),
  FORECAST_SEASONAL_PERIOD: z.coerce.number().int().positive().default(12)
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error(`Invalid backend environment: ${parsedEnv.error.message}`);
}

export const env = parsedEnv.data;
