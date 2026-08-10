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
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  CORS_ORIGINS: z.string().min(1).optional(),
  CORS_ORIGIN: z.string().url().optional(),
  DATABASE_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(1).optional(),
  PYTHON_EXECUTABLE: z.string().min(1).default("python"),
  FORECAST_PROCESS_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  FORECAST_DEFAULT_HORIZON: z.coerce.number().int().positive().default(12),
  FORECAST_SEASONAL_PERIOD: z.coerce.number().int().positive().default(12),
  FORECAST_CURRENT_MONTH: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional()
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error(`Invalid backend environment: ${parsedEnv.error.message}`);
}

export const env = parsedEnv.data;

const defaultCorsOrigins = [
  env.FRONTEND_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "null"
];
const configuredCorsOrigins = env.CORS_ORIGINS ?? env.CORS_ORIGIN;

export const corsOrigins = Object.freeze(
  Array.from(
    new Set(
      (configuredCorsOrigins ? configuredCorsOrigins.split(",") : defaultCorsOrigins)
        .map((origin) => origin.trim().replace(/\/$/, ""))
        .filter(Boolean)
        .map(validateCorsOrigin)
    )
  )
);

export const databaseTarget = describeDatabaseTarget(env.DATABASE_URL);

function validateCorsOrigin(origin: string): string {
  if (origin === "null") return origin;

  try {
    const parsedOrigin = new URL(origin);

    if (parsedOrigin.origin !== origin) {
      throw new Error("Origins must not include paths, queries, or fragments.");
    }

    return origin;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Invalid URL.";
    throw new Error(`Invalid backend CORS origin "${origin}": ${reason}`);
  }
}

function describeDatabaseTarget(databaseUrl: string | undefined) {
  if (!databaseUrl) return null;

  const parsedDatabaseUrl = new URL(databaseUrl);

  return Object.freeze({
    provider: parsedDatabaseUrl.protocol.replace(/:$/, ""),
    host: parsedDatabaseUrl.hostname,
    port: parsedDatabaseUrl.port || "default",
    database: parsedDatabaseUrl.pathname.replace(/^\//, "") || "(not specified)"
  });
}
