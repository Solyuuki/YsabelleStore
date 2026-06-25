export type ApiResponse<TData = unknown, TError = unknown> =
  | ApiSuccessResponse<TData>
  | ApiErrorResponse<TError>;

export type ApiSuccessResponse<TData = unknown> = {
  success: true;
  message: string;
  data?: TData;
};

export type ApiErrorResponse<TError = unknown> = {
  success: false;
  message: string;
  error?: TError;
};
