import type { RequestHandler } from "express";

import { securityConfig } from "../security/securityConfig.js";

export const securityHeaders: RequestHandler = (_request, response, next) => {
  void _request;

  response.setHeader("X-Content-Type-Options", securityConfig.headers.contentTypeOptions);
  response.setHeader("X-Frame-Options", securityConfig.headers.frameOptions);
  response.setHeader("Referrer-Policy", securityConfig.headers.referrerPolicy);
  response.setHeader("Permissions-Policy", securityConfig.headers.permissionsPolicy);
  response.setHeader(
    "Cross-Origin-Resource-Policy",
    securityConfig.headers.crossOriginResourcePolicy
  );

  next();
};
