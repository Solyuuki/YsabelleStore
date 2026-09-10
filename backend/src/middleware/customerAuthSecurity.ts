import type { RequestHandler } from "express";

import { corsOrigins } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

export const disableSensitiveResponseCaching: RequestHandler = (_request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Pragma", "no-cache");
  next();
};

export const requireAllowedCustomerAuthOrigin: RequestHandler = (request, _response, next) => {
  const origin = request.get("origin");

  if (!origin || corsOrigins.includes(origin)) {
    next();
    return;
  }

  next(
    new HttpError(403, "Customer authentication request origin is not allowed.", {
      code: "CUSTOMER_AUTH_ORIGIN_REJECTED"
    })
  );
};
