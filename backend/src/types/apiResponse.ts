export type ApiSuccessResponse<TData> = {
  success: true;
  data: TData;
  message?: string;
};

export type ApiErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown[];
  };
};
