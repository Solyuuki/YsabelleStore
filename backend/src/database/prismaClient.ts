import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { env } from "../config/env.js";

const prismaLogLevels: Prisma.PrismaClientOptions["log"] =
  env.NODE_ENV === "development" ? ["warn", "error"] : ["error"];

const DATABASE_AVAILABLE_MESSAGE = "Database connection is available.";
const DATABASE_UNAVAILABLE_MESSAGE = "Database connection is unavailable.";

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
      message: DATABASE_UNAVAILABLE_MESSAGE
    };
  }

  try {
    await prisma.$queryRaw`SELECT 1`;

    return {
      status: "connected",
      message: DATABASE_AVAILABLE_MESSAGE
    };
  } catch {
    return {
      status: "unavailable",
      message: DATABASE_UNAVAILABLE_MESSAGE
    };
  }
}
