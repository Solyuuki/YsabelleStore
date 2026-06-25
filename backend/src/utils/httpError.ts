export type HttpErrorDetails = {
  code: string;
  details?: unknown;
};

export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  public constructor(statusCode: number, message: string, options: HttpErrorDetails) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = options.code;
    this.details = options.details;
  }
}
