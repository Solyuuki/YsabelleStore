import type { RequestHandler } from "express";

import { env } from "../config/env.js";
import { HTTP_STATUS } from "../constants/httpStatusContract.js";
import { checkDatabaseHealth } from "../database/prismaClient.js";
import { createSuccessResponse } from "../utils/apiResponse.js";

type HealthStatus = "healthy" | "degraded" | "unavailable";

type ServiceHealth = {
  status: HealthStatus;
  ready: boolean;
};

function classifyServiceHealth(databaseStatus: string): ServiceHealth {
  if (databaseStatus !== "connected") {
    return {
      status: "unavailable",
      ready: false
    };
  }

  if (!env.JWT_SECRET) {
    return {
      status: "degraded",
      ready: false
    };
  }

  return {
    status: "healthy",
    ready: true
  };
}

function createHealthData(
  database: Awaited<ReturnType<typeof checkDatabaseHealth>>,
  serviceHealth: ServiceHealth
) {
  return {
    service: "ysabellestore-backend",
    status: serviceHealth.status,
    ready: serviceHealth.ready,
    environment: env.NODE_ENV,
    port: env.PORT,
    configuration: {
      databaseUrlLoaded: Boolean(env.DATABASE_URL),
      jwtSecretLoaded: Boolean(env.JWT_SECRET)
    },
    checks: {
      database: database.status,
      prisma: "client_ready"
    },
    database: {
      message: database.message
    }
  };
}

export const getHealth: RequestHandler = async (_request, response) => {
  const database = await checkDatabaseHealth();
  const serviceHealth = classifyServiceHealth(database.status);

  response
    .status(HTTP_STATUS.OK)
    .json(
      createSuccessResponse("Backend service is running.", createHealthData(database, serviceHealth))
    );
};

export const getLiveness: RequestHandler = (_request, response) => {
  response.status(HTTP_STATUS.OK).json(
    createSuccessResponse("Backend process is alive.", {
      service: "ysabellestore-backend",
      status: "healthy" as const
    })
  );
};

export const getReadiness: RequestHandler = async (_request, response) => {
  const database = await checkDatabaseHealth();
  const serviceHealth = classifyServiceHealth(database.status);
  const statusCode = serviceHealth.ready ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE;

  response.status(statusCode).json(
    createSuccessResponse(
      serviceHealth.ready ? "Backend service is ready." : "Backend service is not ready.",
      createHealthData(database, serviceHealth)
    )
  );
};
