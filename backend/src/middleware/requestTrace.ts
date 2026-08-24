import { randomUUID } from "node:crypto";

import type { RequestHandler } from "express";

export const REQUEST_ID_HEADER = "x-request-id";

export const requestTrace: RequestHandler = (_request, response, next) => {
  const requestId = randomUUID();
  response.locals.requestId = requestId;
  response.setHeader(REQUEST_ID_HEADER, requestId);
  next();
};

export function getRequestId(response: { locals: Record<string, unknown> }) {
  const value = response.locals.requestId;
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
