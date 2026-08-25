import { createHmac, randomBytes } from "node:crypto";

import type { Request, RequestHandler } from "express";

import { HttpError } from "../utils/httpError.js";

type AuthRateLimitOptions = {
  windowMs: number;
  maxAttempts: number;
  scope: string;
  keyResolver?: (request: Request) => string | null;
};

type RateLimitEntry = {
  count: number;
  windowStartedAt: number;
};

const PROCESS_RATE_LIMIT_SECRET = randomBytes(32);
const limiterAttempts = new WeakMap<RequestHandler, Map<string, RateLimitEntry>>();

export function derivePrivateRateLimitKey(scope: string, value: string): string {
  return createHmac("sha256", PROCESS_RATE_LIMIT_SECRET)
    .update(`${scope}:${value}`)
    .digest("hex");
}

export function createAuthRateLimit(options: AuthRateLimitOptions): RequestHandler {
  const attempts = new Map<string, RateLimitEntry>();

  const limiter: RequestHandler = (request, response, next) => {
    const now = Date.now();
    const resolvedKey = options.keyResolver
      ? options.keyResolver(request)
      : `${options.scope}:${request.ip || request.socket.remoteAddress || "unknown"}`;

    if (!resolvedKey) {
      next();
      return;
    }

    const current = attempts.get(resolvedKey);

    if (!current || now - current.windowStartedAt >= options.windowMs) {
      attempts.set(resolvedKey, { count: 1, windowStartedAt: now });
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

  limiterAttempts.set(limiter, attempts);
  return limiter;
}

export function inspectAuthRateLimitKeysForTest(limiter: RequestHandler): string[] {
  return [...(limiterAttempts.get(limiter)?.keys() ?? [])];
}
