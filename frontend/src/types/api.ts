export type ApiResponse<TData = unknown, TError = unknown, TMeta = unknown> =
  | ApiSuccessResponse<TData, TMeta>
  | ApiErrorResponse<TError>;

export type ApiResponseTransport = {
  httpStatus?: number;
  retryAfterSeconds?: number;
};

export type ApiSuccessResponse<TData = unknown, TMeta = unknown> = ApiResponseTransport & {
  success: true;
  message: string;
  data?: TData;
  meta?: TMeta;
};

export type ApiErrorResponse<TError = unknown> = ApiResponseTransport & {
  success: false;
  message: string;
  error?: TError;
};
