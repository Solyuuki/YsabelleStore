import type { ErrorRequestHandler } from "express";
import { MulterError } from "multer";

import { HTTP_STATUS, isCanonicalHttpStatusCode } from "../constants/httpStatusContract.js";
import { createErrorResponse } from "../utils/apiResponse.js";
import { HttpError } from "../utils/httpError.js";
import { getRequestId } from "./requestTrace.js";

type ErrorPayload = {
  code: string;
  details?: unknown;
};

const INTERNAL_ERROR_MESSAGE = "An unexpected error occurred.";
const INTERNAL_ERROR_CODE = "INTERNAL_SERVER_ERROR";

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  void _next;

  const isFileSizeError = error instanceof MulterError && error.code === "LIMIT_FILE_SIZE";
  const isHttpError = error instanceof HttpError;
  const isCanonicalHttpError = isHttpError && isCanonicalHttpStatusCode(error.statusCode);
  const isSafeHttpError =
    isCanonicalHttpError && error.expose && error.statusCode < HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const requestId = getRequestId(response);

  const statusCode = isFileSizeError
    ? HTTP_STATUS.PAYLOAD_TOO_LARGE
    : isCanonicalHttpError
      ? error.statusCode
      : HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const safeServerFailure = serverFailureEnvelope(statusCode);
  const message = isSafeHttpError
    ? error.message
    : isFileSizeError
      ? "The uploaded file is too large."
      : safeServerFailure.message;
  const payload: ErrorPayload = {
    code: isSafeHttpError ? error.code : isFileSizeError ? "FILE_TOO_LARGE" : safeServerFailure.code
  };

  if (isSafeHttpError && error.details !== undefined) {
    payload.details = error.details;
  } else if (!isFileSizeError) {
    payload.details = requestId ? { requestId } : null;
  }

  if (isFileSizeError) {
    payload.details = {
      limit: "5MB"
    };
  }

  if (statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
    console.error(
      JSON.stringify({
        event: "http_request_failed",
        requestId,
        statusCode,
        errorType: error instanceof Error ? error.name : "UnknownError",
        errorCode: error instanceof HttpError ? error.code : INTERNAL_ERROR_CODE
      })
    );
  }

  response.status(statusCode).json(createErrorResponse(message, payload));
};

function serverFailureEnvelope(statusCode: number) {
  switch (statusCode) {
    case HTTP_STATUS.BAD_GATEWAY:
      return {
        code: "BAD_GATEWAY",
        message: "A required service returned an invalid response."
      };
    case HTTP_STATUS.SERVICE_UNAVAILABLE:
      return {
        code: "SERVICE_UNAVAILABLE",
        message: "A required service is temporarily unavailable."
      };
    case HTTP_STATUS.GATEWAY_TIMEOUT:
      return {
        code: "GATEWAY_TIMEOUT",
        message: "A required service took too long to respond."
      };
    default:
      return {
        code: INTERNAL_ERROR_CODE,
        message: INTERNAL_ERROR_MESSAGE
      };
  }
}
