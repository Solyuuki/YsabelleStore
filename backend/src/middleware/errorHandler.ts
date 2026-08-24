import type { ErrorRequestHandler } from "express";
import { MulterError } from "multer";

import { HTTP_STATUS } from "../constants/httpStatusContract.js";
import { createErrorResponse } from "../utils/apiResponse.js";
import { HttpError } from "../utils/httpError.js";

type ErrorPayload = {
  code: string;
  details?: unknown;
};

const INTERNAL_ERROR_MESSAGE = "An unexpected error occurred.";
const INTERNAL_ERROR_CODE = "INTERNAL_SERVER_ERROR";

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  void _next;

  const isFileSizeError = error instanceof MulterError && error.code === "LIMIT_FILE_SIZE";
  const isSafeHttpError = error instanceof HttpError && error.statusCode < HTTP_STATUS.INTERNAL_SERVER_ERROR;

  const statusCode = isSafeHttpError
    ? error.statusCode
    : isFileSizeError
      ? HTTP_STATUS.PAYLOAD_TOO_LARGE
      : HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = isSafeHttpError
    ? error.message
    : isFileSizeError
      ? "The uploaded file is too large."
      : INTERNAL_ERROR_MESSAGE;
  const payload: ErrorPayload = {
    code: isSafeHttpError
      ? error.code
      : isFileSizeError
        ? "FILE_TOO_LARGE"
        : INTERNAL_ERROR_CODE
  };

  if (isSafeHttpError && error.details !== undefined) {
    payload.details = error.details;
  } else if (!isFileSizeError) {
    payload.details = null;
  }

  if (isFileSizeError) {
    payload.details = {
      limit: "5MB"
    };
  }

  if (statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
    console.error(error);
  }

  response.status(statusCode).json(createErrorResponse(message, payload));
};
