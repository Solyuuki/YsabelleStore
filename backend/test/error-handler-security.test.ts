import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import express from "express";

import { errorHandler } from "../src/middleware/errorHandler.js";
import { HttpError } from "../src/utils/httpError.js";

type ErrorBody = {
  success?: boolean;
  message?: string;
  error?: {
    code?: string;
    details?: unknown;
  };
};

async function withErrorServer(
  error: Error,
  run: (baseUrl: string) => Promise<void>
) {
  const app = express();
  app.get("/failure", (_request, _response, next) => next(error));
  app.use(errorHandler);

  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });

    const address = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((closeError) => (closeError ? reject(closeError) : resolve()));
    });
  }
}

async function json(response: Response): Promise<ErrorBody> {
  return (await response.json()) as ErrorBody;
}

test("unexpected backend failures return the generic 500 envelope without leaking diagnostics", async () => {
  const secret = "mysql://admin:super-secret@db.internal:3306/ysabelle";

  await withErrorServer(new Error(`database failure at ${secret}`), async (baseUrl) => {
    const response = await fetch(`${baseUrl}/failure`);
    const body = await json(response);

    assert.equal(response.status, 500);
    assert.equal(body.success, false);
    assert.equal(body.error?.code, "INTERNAL_SERVER_ERROR");
    assert.equal(body.message, "An unexpected error occurred.");
    assert.equal(body.error?.details, null);
    assert.doesNotMatch(JSON.stringify(body), /super-secret|db\.internal/);
  });
});

test("server-side HttpError diagnostics are sanitized instead of exposing internal messages or details", async () => {
  const secret = "jwt-secret-value";
  const error = new HttpError(500, `failed using ${secret}`, {
    code: "UPSTREAM_FAILURE",
    details: {
      dependency: `https://service.internal/?token=${secret}`
    }
  });

  await withErrorServer(error, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/failure`);
    const body = await json(response);

    assert.equal(response.status, 500);
    assert.equal(body.success, false);
    assert.equal(body.error?.code, "INTERNAL_SERVER_ERROR");
    assert.equal(body.message, "An unexpected error occurred.");
    assert.equal(body.error?.details, null);
    assert.doesNotMatch(JSON.stringify(body), /jwt-secret-value|service\.internal/);
  });
});

test("expected client HttpError responses preserve their safe status, code, message, and details", async () => {
  const error = new HttpError(422, "Product input is invalid.", {
    code: "VALIDATION_ERROR",
    details: {
      field: "productName"
    }
  });

  await withErrorServer(error, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/failure`);
    const body = await json(response);

    assert.equal(response.status, 422);
    assert.equal(body.error?.code, "VALIDATION_ERROR");
    assert.equal(body.message, "Product input is invalid.");
    assert.deepEqual(body.error?.details, { field: "productName" });
  });
});
