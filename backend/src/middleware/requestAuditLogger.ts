import type { RequestHandler } from "express";

import { getRequestId } from "./requestTrace.js";

export const requestAuditLogger: RequestHandler = (request, response, next) => {
  const startedAt = performance.now();

  response.once("finish", () => {
    console.info(
      JSON.stringify({
        event: "http_request_completed",
        requestId: getRequestId(response),
        method: request.method,
        path: request.path,
        statusCode: response.statusCode,
        durationMs: Math.max(0, Math.round(performance.now() - startedAt))
      })
    );
  });

  next();
};
