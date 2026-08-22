import type { RequestHandler } from "express";

import { HttpError } from "../utils/httpError.js";

type AuthRateLimitOptions = {
  windowMs: number;
  maxAttempts: number;
  scope: string;
};

type RateLimitEntry = {
  count: number;
  windowStartedAt: number;
};

export function createAuthRateLimit(options: AuthRateLimitOptions): RequestHandler {
  const attempts = new Map<string, RateLimitEntry>();

  return (request, response, next) => {
    const now = Date.now();
    const clientAddress = request.ip || request.socket.remoteAddress || "unknown";
    const key = `${options.scope}:${clientAddress}`;
    const current = attempts.get(key);

    if (!current || now - current.windowStartedAt >= options.windowMs) {
      attempts.set(key, { count: 1, windowStartedAt: now });
      next();
      return;
    }

    if (current.count >= options.maxAttempts) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((current.windowStartedAt + options.windowMs - now) / 1000)
      );
      response.setHeader("Retry-After", String(retryAfterSeconds));
      next(
        new HttpError(429, "Too many authentication attempts. Please try again later.", {
          code: "AUTH_RATE_LIMITED"
        })
      );
      return;
    }

    current.count += 1;
    next();
  };
}
