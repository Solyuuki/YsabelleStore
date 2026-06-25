import type { RequestHandler } from "express";

import { securityConfig } from "../security/securityConfig.js";

export const rateLimitFoundation: RequestHandler = (request, response, next) => {
  void request;

  response.setHeader(
    "X-Rate-Limit-Policy",
    `${securityConfig.limits.plannedRateLimitMaxRequests};w=${securityConfig.limits.plannedRateLimitWindowMinutes}m`
  );

  next();
};
