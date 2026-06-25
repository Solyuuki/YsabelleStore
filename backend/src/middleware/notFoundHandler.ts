import type { RequestHandler } from "express";

import { HttpError } from "../utils/httpError.js";

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(
    new HttpError(404, `Route not found: ${request.method} ${request.originalUrl}`, {
      code: "NOT_FOUND"
    })
  );
};
