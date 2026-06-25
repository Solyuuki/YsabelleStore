import type { ErrorRequestHandler } from "express";

import { createErrorResponse } from "../utils/apiResponse.js";
import { HttpError } from "../utils/httpError.js";

type ErrorPayload = {
  code: string;
  details?: unknown;
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  void _next;

  const statusCode = error instanceof HttpError ? error.statusCode : 500;
  const message = error instanceof HttpError ? error.message : "Unexpected server error.";
  const payload: ErrorPayload = {
    code: error instanceof HttpError ? error.code : "SERVER_ERROR"
  };

  if (error instanceof HttpError && error.details !== undefined) {
    payload.details = error.details;
  }

  if (statusCode >= 500) {
    console.error(error);
  }

  response.status(statusCode).json(createErrorResponse(message, payload));
};
