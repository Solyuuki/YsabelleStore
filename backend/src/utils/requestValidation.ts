import type { ZodTypeAny } from "zod";

import { HttpError } from "./httpError.js";

export function parseOrThrow<TSchema extends ZodTypeAny>(
  schema: TSchema,
  value: unknown,
  options: {
    statusCode?: number;
    message: string;
    code: string;
  }
): TSchema["_output"] {
  const parsed = schema.safeParse(value);

  if (!parsed.success) {
    throw new HttpError(options.statusCode ?? 400, options.message, {
      code: options.code,
      details: parsed.error.flatten()
    });
  }

  return parsed.data;
}
