import type { ApiErrorResponse, ApiSuccessResponse } from "../types/apiResponse.js";

export function createSuccessResponse<TData>(
  message: string,
  data?: TData
): ApiSuccessResponse<TData> {
  return data === undefined
    ? {
        success: true,
        message
      }
    : {
        success: true,
        message,
        data
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
