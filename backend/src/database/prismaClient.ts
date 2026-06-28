import { PrismaClient, type Prisma } from "@prisma/client";

import { env } from "../config/env.js";

const prismaLogLevels: Prisma.LogLevel[] =
  env.NODE_ENV === "development" ? ["warn", "error"] : ["error"];

export const prisma = new PrismaClient({
  log: prismaLogLevels
});

export type DatabaseHealth =
  | {
      status: "not_configured";
      message: string;
    }
  | {
      status: "connected";
      message: string;
    }
  | {
      status: "unavailable";
      message: string;
    };

export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  if (!env.DATABASE_URL) {
    return {
      status: "not_configured",
      message: "DATABASE_URL is not configured."
    };
  }

  try {
    await prisma.$queryRaw`SELECT 1`;

    return {
      status: "connected",
      message: "Database connection is available."
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database connection error.";

    return {
      status: "unavailable",
      message
    };
  }
}
