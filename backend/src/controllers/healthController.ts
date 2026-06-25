import type { RequestHandler } from "express";

import { env } from "../config/env.js";
import { createSuccessResponse } from "../utils/apiResponse.js";

export const getHealth: RequestHandler = (_request, response) => {
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
        database: "not_configured_for_foundation",
        prisma: "not_configured_for_foundation"
      }
    })
  );
};
