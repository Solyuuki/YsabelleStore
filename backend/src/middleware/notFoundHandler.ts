import type { RequestHandler } from "express";

import { HTTP_STATUS } from "../constants/httpStatusContract.js";
import { HttpError } from "../utils/httpError.js";

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(
    new HttpError(
      HTTP_STATUS.NOT_FOUND,
      `Route not found: ${request.method} ${request.originalUrl}`,
      {
        code: "NOT_FOUND"
      }
    )
  );
};
