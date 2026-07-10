import { frontendEnv } from "@/schemas/frontendEnv.schema";
import type { ApiResponse } from "@/types/api";

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  json?: unknown;
  formData?: FormData;
};

export type ApiRequestContext = {
  url: URL;
  init: RequestInit;
};

export type ApiRequestInterceptor = (
  context: ApiRequestContext
) => ApiRequestContext | Promise<ApiRequestContext>;

export type ApiResponseInterceptor = (response: ApiResponse) => ApiResponse | Promise<ApiResponse>;

type ApiClientConfig = {
  baseUrl: string;
};

export class ApiClient {
  private readonly baseUrl: string;
  private readonly requestInterceptors: ApiRequestInterceptor[] = [];
  private readonly responseInterceptors: ApiResponseInterceptor[] = [];

  public constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl;
  }

  public addRequestInterceptor(interceptor: ApiRequestInterceptor) {
    this.requestInterceptors.push(interceptor);

    return () => {
      const index = this.requestInterceptors.indexOf(interceptor);

      if (index >= 0) {
        this.requestInterceptors.splice(index, 1);
      }
    };
  }

  public addResponseInterceptor(interceptor: ApiResponseInterceptor) {
    this.responseInterceptors.push(interceptor);

    return () => {
      const index = this.responseInterceptors.indexOf(interceptor);

      if (index >= 0) {
        this.responseInterceptors.splice(index, 1);
      }
    };
  }

  public async request<TData = unknown, TError = unknown, TMeta = unknown>(
    path: string,
    options: ApiRequestOptions = {}
  ): Promise<ApiResponse<TData, TError, TMeta>> {
    const { formData, json, headers, ...initOptions } = options;
    const requestHeaders = new Headers(headers);

    if (json !== undefined && formData !== undefined) {
      throw new Error("ApiClient request cannot include both json and formData.");
    }

    if (json !== undefined) {
      requestHeaders.set("Content-Type", "application/json");
    }

    let context: ApiRequestContext = {
      url: new URL(path, this.baseUrl),
      init: {
        ...initOptions,
        headers: requestHeaders,
        body:
          json !== undefined ? JSON.stringify(json) : formData !== undefined ? formData : undefined
      }
    };

    for (const interceptor of this.requestInterceptors) {
      context = await interceptor(context);
    }

    const response = await fetch(context.url, context.init);
    const payload = await this.parseResponse<TData, TError>(response);

    let interceptedPayload: ApiResponse = payload;

    for (const interceptor of this.responseInterceptors) {
      interceptedPayload = await interceptor(interceptedPayload);
    }

    return interceptedPayload as ApiResponse<TData, TError, TMeta>;
  }

  private async parseResponse<TData, TError>(
    response: Response
  ): Promise<ApiResponse<TData, TError, unknown>> {
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      return (await response.json()) as ApiResponse<TData, TError>;
    }

    return {
      success: false,
      message: "API response was not valid JSON.",
      error: {
        status: response.status,
        statusText: response.statusText
      } as TError
    };
  }
}

export const apiClient = new ApiClient({
  baseUrl: frontendEnv.VITE_API_BASE_URL
});
