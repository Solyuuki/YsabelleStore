import cors from "cors";
import express from "express";

import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFoundHandler.js";
import { rateLimitFoundation } from "./middleware/rateLimitPlaceholder.js";
import { securityHeaders } from "./middleware/securityHeaders.js";
import { router } from "./routes/index.js";
import { securityConfig } from "./security/securityConfig.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.CORS_ORIGIN
    })
  );
  app.use(securityHeaders);
  app.use(rateLimitFoundation);
  app.use(express.json({ limit: securityConfig.limits.jsonBodyLimit }));
  app.use("/api", router);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
