export type HttpErrorDetails = {
  code: string;
  details?: unknown;
  expose?: boolean;
};

export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly expose: boolean;

  public constructor(statusCode: number, message: string, options: HttpErrorDetails) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = options.code;
    this.details = options.details;
    this.expose = options.expose ?? statusCode < 500;
  }
}
