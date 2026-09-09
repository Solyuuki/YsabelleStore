import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";

import { env } from "../config/env.js";

const prismaLogLevels: Prisma.PrismaClientOptions["log"] =
  env.NODE_ENV === "development" ? ["warn", "error"] : ["error"];

const DATABASE_AVAILABLE_MESSAGE = "Database connection is available.";
const DATABASE_UNAVAILABLE_MESSAGE = "Database connection is unavailable.";

// These source identities are permanently retired from YsabelleStore's operational
// catalog because the store does not sell alcohol. Their Product rows remain in the
// database only to preserve referential integrity for historical/source records.
const RETIRED_OPERATIONAL_PRODUCT_SKUS = ["SARIMA-P254", "SARIMA-P255"] as const;

const basePrisma = new PrismaClient({
  log: prismaLogLevels
});

const operationalPrisma = basePrisma.$extends({
  query: {
    product: {
      async findMany({ args, query }) {
        args.where = {
          AND: [
            args.where ?? {},
            {
              sku: {
                notIn: [...RETIRED_OPERATIONAL_PRODUCT_SKUS]
              }
            }
          ]
        };

        return query(args);
      }
    }
  }
});

// Prisma client extensions preserve the runtime client/transaction surface used by
// the application, but Prisma's generated extension type is intentionally narrower
// than PrismaClient and caused transaction helpers/tests to reject the shared client.
// Keep one canonical PrismaClient contract at the application boundary while the
// operational findMany guard remains active at runtime.
export const prisma: PrismaClient = operationalPrisma as unknown as PrismaClient;

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
