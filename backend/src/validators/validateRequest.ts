import type { RequestHandler } from "express";
import type { ZodTypeAny } from "zod";
import { ZodError } from "zod";

import { HttpError } from "../utils/httpError.js";

type RequestValidationSchema = {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
};

function formatZodError(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message
  }));
}

export function validateRequest(schema: RequestValidationSchema): RequestHandler {
  return (request, _response, next) => {
    try {
      if (schema.params) {
        request.params = schema.params.parse(request.params);
      }

      if (schema.query) {
        request.query = schema.query.parse(request.query);
      }

      if (schema.body) {
        request.body = schema.body.parse(request.body);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          new HttpError(400, "Request validation failed.", {
            code: "VALIDATION_ERROR",
            details: formatZodError(error)
          })
        );
        return;
      }

      next(error);
    }
  };
}
