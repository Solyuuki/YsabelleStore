import type { RequestHandler } from "express";

import { HTTP_STATUS } from "../constants/httpStatusContract.js";
import { getAllowedMethodsForApiPath } from "../routes/apiMethodContract.js";
import { HttpError } from "../utils/httpError.js";

export const methodNotAllowedHandler: RequestHandler = (request, response, next) => {
  if (request.method === "OPTIONS") {
    next();
    return;
  }

  const allowedMethods = getAllowedMethodsForApiPath(request.path);
  if (allowedMethods.length === 0 || allowedMethods.includes(request.method.toUpperCase())) {
    next();
    return;
  }

  response.setHeader("Allow", allowedMethods.join(", "));
  next(
    new HttpError(
      HTTP_STATUS.METHOD_NOT_ALLOWED,
      `Method ${request.method.toUpperCase()} is not allowed for this API resource.`,
      {
        code: "METHOD_NOT_ALLOWED",
        details: {
          allowedMethods
        }
      }
    )
  );
};
