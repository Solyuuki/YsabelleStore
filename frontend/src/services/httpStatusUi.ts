export type HttpStatusUiSeverity = "success" | "info" | "warning" | "error";

export type HttpStatusUiCategory =
  | "success"
  | "request-error"
  | "authentication"
  | "authorization"
  | "not-found"
  | "method-not-allowed"
  | "conflict"
  | "payload-too-large"
  | "unsupported-media"
  | "validation"
  | "rate-limited"
  | "server-error"
  | "upstream-error"
  | "service-unavailable"
  | "gateway-timeout"
  | "unknown";

export type HttpStatusUiDescriptor = {
  blocking: boolean;
  category: HttpStatusUiCategory;
  message: string;
  retryable: boolean;
  severity: HttpStatusUiSeverity;
  title: string;
};

export function resolveHttpStatusUi(
  status: number | undefined,
  options: {
    message?: string;
    retryAfterSeconds?: number;
  } = {}
): HttpStatusUiDescriptor {
  const serverMessage = options.message?.trim();

  switch (status) {
    case 200:
    case 201:
    case 202:
    case 204:
      return descriptor(
        "success",
        "Success",
        serverMessage ?? "The request completed successfully.",
        {
          severity: "success"
        }
      );
    case 400:
      return descriptor(
        "request-error",
        "Request could not be processed",
        serverMessage ?? "Please review the request and try again."
      );
    case 401:
      return descriptor(
        "authentication",
        "Sign in required",
        serverMessage ?? "Your session is missing or has expired. Please sign in again.",
        { blocking: true }
      );
    case 403:
      return descriptor(
        "authorization",
        "Access denied",
        serverMessage ?? "You do not have permission to perform this action.",
        { blocking: true }
      );
    case 404:
      return descriptor(
        "not-found",
        "Not found",
        serverMessage ?? "The requested page or resource could not be found."
      );
    case 405:
      return descriptor(
        "method-not-allowed",
        "Action unavailable",
        serverMessage ?? "This action is not supported for the requested resource."
      );
    case 409:
      return descriptor(
        "conflict",
        "Information changed",
        serverMessage ?? "The current data changed before this action could be completed.",
        { retryable: true }
      );
    case 413:
      return descriptor(
        "payload-too-large",
        "File or request is too large",
        serverMessage ?? "Choose a smaller file or reduce the request size."
      );
    case 415:
      return descriptor(
        "unsupported-media",
        "Unsupported file type",
        serverMessage ?? "Choose a supported file or content type."
      );
    case 422:
      return descriptor(
        "validation",
        "Check the information provided",
        serverMessage ?? "Some information is missing or invalid."
      );
    case 429: {
      const retrySuffix =
        options.retryAfterSeconds !== undefined
          ? ` Try again in ${options.retryAfterSeconds} second${options.retryAfterSeconds === 1 ? "" : "s"}.`
          : " Please try again shortly.";

      return descriptor(
        "rate-limited",
        "Too many attempts",
        serverMessage
          ? `${serverMessage}${retrySuffix}`
          : `Too many requests were made.${retrySuffix}`,
        { retryable: true, severity: "warning" }
      );
    }
    case 500:
      return descriptor(
        "server-error",
        "Something went wrong",
        serverMessage ?? "An unexpected server error occurred. Please try again.",
        { retryable: true }
      );
    case 502:
      return descriptor(
        "upstream-error",
        "Connected service unavailable",
        serverMessage ?? "A service Ysabelle Store depends on returned an invalid response.",
        { retryable: true }
      );
    case 503:
      return descriptor(
        "service-unavailable",
        "Service temporarily unavailable",
        serverMessage ?? "Ysabelle Store is not ready right now. Please wait while we reconnect.",
        { blocking: true, retryable: true }
      );
    case 504:
      return descriptor(
        "gateway-timeout",
        "Service took too long",
        serverMessage ?? "A connected service did not respond in time. Please try again.",
        { retryable: true }
      );
    default:
      return descriptor(
        "unknown",
        "Request failed",
        serverMessage ?? "The request could not be completed. Please try again.",
        { retryable: true }
      );
  }
}

function descriptor(
  category: HttpStatusUiCategory,
  title: string,
  message: string,
  options: {
    blocking?: boolean;
    retryable?: boolean;
    severity?: HttpStatusUiSeverity;
  } = {}
): HttpStatusUiDescriptor {
  return {
    blocking: options.blocking ?? false,
    category,
    message,
    retryable: options.retryable ?? false,
    severity: options.severity ?? "error",
    title
  };
}
