export type ApiResponse<TData = unknown, TError = unknown> =
  | ApiSuccessResponse<TData>
  | ApiErrorResponse<TError>;

export type ApiSuccessResponse<TData = unknown, TMeta = unknown> = {
  success: true;
  message: string;
  data?: TData;
  meta?: TMeta;
};

export type ApiErrorResponse<TError = unknown> = {
  success: false;
  message: string;
  error?: TError;
};
