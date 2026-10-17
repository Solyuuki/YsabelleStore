import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { z } from "zod";

import {
  resolveCatalogImageStoragePaths,
  resolveDefaultCatalogImagePersistentRoot
} from "./catalogImageStoragePaths.js";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);
const repositoryRoot = path.resolve(currentDirectory, "../../..");
const rootEnvPath = path.join(repositoryRoot, ".env");

loadEnv({ path: rootEnvPath });

const optionalNonEmptyString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional()
);

const optionalEmail = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().email().optional()
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  CORS_ORIGINS: z.string().min(1).optional(),
  CORS_ORIGIN: z.string().url().optional(),
  DATABASE_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(1).optional(),
  PAYMONGO_SECRET_KEY: optionalNonEmptyString,
  PAYMONGO_WEBHOOK_SECRET: optionalNonEmptyString,
  RESEND_API_KEY: z.string().min(1).optional(),
  BREVO_API_KEY: optionalNonEmptyString,
  BREVO_SENDER_EMAIL: optionalEmail,
  SUPPORT_EMAIL_PROVIDER: z.enum(["gmail_api", "brevo"]).default("gmail_api"),
  CUSTOMER_EMAIL_PROVIDER: z.enum(["resend", "gmail_smtp", "gmail_api", "brevo"]).default("resend"),
  SMTP_USER: optionalEmail,
  SMTP_PASSWORD: optionalNonEmptyString,
  CUSTOMER_RECOVERY_FROM_EMAIL: z.string().email().optional(),
  CUSTOMER_DEV_GMAIL_SMTP_USER: z.string().email().optional(),
  CUSTOMER_DEV_GMAIL_SMTP_APP_PASSWORD: optionalNonEmptyString,
  CUSTOMER_OAUTH_PUBLIC_BACKEND_URL: z.string().url().optional(),
  CUSTOMER_OAUTH_TRANSACTION_KEY: z.string().min(32).optional(),
  GOOGLE_OAUTH_CLIENT_ID: optionalNonEmptyString,
  GOOGLE_OAUTH_CLIENT_SECRET: optionalNonEmptyString,
  CUSTOMER_SUPPORT_EMAIL: optionalEmail,
  CUSTOMER_SUPPORT_FROM_NAME: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .default("Ysabelle Store Customer Support"),
  GOOGLE_GMAIL_REFRESH_TOKEN: optionalNonEmptyString,
  FACEBOOK_OAUTH_APP_ID: optionalNonEmptyString,
  FACEBOOK_OAUTH_APP_SECRET: optionalNonEmptyString,
  FACEBOOK_GRAPH_API_VERSION: z
    .string()
    .regex(/^v\d+\.\d+$/)
    .default("v26.0"),
  PYTHON_EXECUTABLE: z.string().min(1).default("python"),
  CATALOG_IMAGE_STORAGE_ROOT: z.string().min(1).default(".data/catalog-images"),
  CATALOG_IMAGE_PROCESS_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
  FORECAST_PROCESS_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  FORECAST_DEFAULT_HORIZON: z.coerce.number().int().positive().default(12),
  FORECAST_SEASONAL_PERIOD: z.coerce.number().int().positive().default(12),
  FORECAST_WORKERS: z.coerce.number().int().min(1).max(4).default(4),
  SARIMA_FIT_TIMEOUT_SECONDS: z.coerce.number().positive().max(60).default(8),
  RECOMMENDER_AI_PROVIDER: z.enum(["auto", "cloudflare", "groq", "disabled"]).default("auto"),
  RECOMMENDER_AI_TIMEOUT_MS: z.coerce.number().int().positive().max(15_000).default(4_000),
  CLOUDFLARE_AI_ACCOUNT_ID: optionalNonEmptyString,
  CLOUDFLARE_AI_API_TOKEN: optionalNonEmptyString,
  CLOUDFLARE_AI_MODEL: optionalNonEmptyString,
  GROQ_API_KEY: optionalNonEmptyString,
  GROQ_AI_MODEL: optionalNonEmptyString,
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
const developmentCatalogImagePersistentRoot =
  env.NODE_ENV === "development" && !path.isAbsolute(env.CATALOG_IMAGE_STORAGE_ROOT)
    ? resolveDefaultCatalogImagePersistentRoot({
        environment: process.env,
        homeDirectory: os.homedir(),
        platform: process.platform
      })
    : undefined;
const catalogImageStoragePaths = resolveCatalogImageStoragePaths(
  repositoryRoot,
  env.CATALOG_IMAGE_STORAGE_ROOT,
  developmentCatalogImagePersistentRoot
);
export const catalogImageStorageRoot = catalogImageStoragePaths.root;
export const catalogImageStorageFallbackRoots = catalogImageStoragePaths.fallbackRoots;

// Mobile QA runs Vite on 5174 against the same backend and session cookie.
// Explicitly trust only this development preview port on loopback or this
// machine's private LAN interfaces; never relax production's origin allowlist.
const localMobilePreviewOrigins = [
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  ...Object.values(os.networkInterfaces())
    .flatMap((interfaces) => interfaces ?? [])
    .filter(
      (address) =>
        address.family === "IPv4" &&
        !address.internal &&
        /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(address.address)
    )
    .map((address) => `http://${address.address}:5174`)
];
const localCorsOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  ...localMobilePreviewOrigins,
  "null"
];
const configuredCorsOrigins = env.CORS_ORIGINS ?? env.CORS_ORIGIN;
const configuredCorsOriginList = configuredCorsOrigins
  ? configuredCorsOrigins.split(",")
  : [env.FRONTEND_URL, "null"];
const corsOriginCandidates =
  env.NODE_ENV === "production"
    ? configuredCorsOriginList
    : [...configuredCorsOriginList, ...localCorsOrigins];

export const corsOrigins = Object.freeze(
  Array.from(
    new Set(
      corsOriginCandidates
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
