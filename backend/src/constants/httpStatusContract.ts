export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNPROCESSABLE_CONTENT: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

export type CanonicalHttpStatusCode = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS];

const canonicalHttpStatusCodes = new Set<number>(Object.values(HTTP_STATUS));

export function isCanonicalHttpStatusCode(value: number): value is CanonicalHttpStatusCode {
  return canonicalHttpStatusCodes.has(value);
}
