import type { RequestHandler } from "express";

import { env } from "../config/env.js";
import { checkDatabaseHealth } from "../database/prismaClient.js";
import { createSuccessResponse } from "../utils/apiResponse.js";

export const getHealth: RequestHandler = async (_request, response) => {
  const database = await checkDatabaseHealth();

  response.status(200).json(
    createSuccessResponse("Backend service is running.", {
      service: "ysabellestore-backend",
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
    })
  );
};
