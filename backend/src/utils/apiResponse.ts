import type { ApiErrorResponse, ApiSuccessResponse } from "../types/apiResponse.js";

export function createSuccessResponse<TData, TMeta = unknown>(
  message: string,
  data?: TData,
  meta?: TMeta
): ApiSuccessResponse<TData, TMeta> {
  return data === undefined && meta === undefined
    ? {
        success: true,
        message
      }
    : meta === undefined
      ? {
          success: true,
          message,
          data
        }
      : {
          success: true,
          message,
          data,
          meta
        };
}

export function createErrorResponse<TError>(
  message: string,
  error?: TError
): ApiErrorResponse<TError> {
  return error === undefined
    ? {
        success: false,
        message
      }
    : {
        success: false,
        message,
        error
      };
}
