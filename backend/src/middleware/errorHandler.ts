import type { ErrorRequestHandler } from "express";
import { MulterError } from "multer";

import { createErrorResponse } from "../utils/apiResponse.js";
import { HttpError } from "../utils/httpError.js";

type ErrorPayload = {
  code: string;
  details?: unknown;
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  void _next;

  const statusCode =
    error instanceof HttpError
      ? error.statusCode
      : error instanceof MulterError && error.code === "LIMIT_FILE_SIZE"
        ? 413
        : 500;
  const message =
    error instanceof HttpError
      ? error.message
      : error instanceof MulterError && error.code === "LIMIT_FILE_SIZE"
        ? "The uploaded file is too large."
        : "Unexpected server error.";
  const payload: ErrorPayload = {
    code:
      error instanceof HttpError
        ? error.code
        : error instanceof MulterError && error.code === "LIMIT_FILE_SIZE"
          ? "FILE_TOO_LARGE"
          : "SERVER_ERROR"
  };

  if (error instanceof HttpError && error.details !== undefined) {
    payload.details = error.details;
  }

  if (error instanceof MulterError && error.code === "LIMIT_FILE_SIZE") {
    payload.details = {
      limit: "5MB"
    };
  }

  if (statusCode >= 500) {
    console.error(error);
  }

  response.status(statusCode).json(createErrorResponse(message, payload));
};
