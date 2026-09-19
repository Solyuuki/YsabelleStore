import cors from "cors";
import express from "express";

import { corsOrigins } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFoundHandler.js";
import { requestAuditLogger } from "./middleware/requestAuditLogger.js";
import { requestTrace } from "./middleware/requestTrace.js";
import { securityHeaders } from "./middleware/securityHeaders.js";
import { router } from "./routes/index.js";
import { securityConfig } from "./security/securityConfig.js";

export function createApp() {
  const app = express();

  app.use(requestTrace);
  app.use(requestAuditLogger);
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        callback(null, origin === undefined || corsOrigins.includes(origin));
      }
    })
  );
  app.use(securityHeaders);
  app.use(express.json({ limit: securityConfig.limits.jsonBodyLimit }));
  app.use("/api", router);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
