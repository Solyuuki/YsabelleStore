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

async function withErrorServer(error: Error, run: (baseUrl: string) => Promise<void>) {
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

test("canonical upstream failures preserve 502/503/504 while sanitizing diagnostics", async () => {
  for (const scenario of [
    { status: 502, expectedCode: "BAD_GATEWAY" },
    { status: 503, expectedCode: "SERVICE_UNAVAILABLE" },
    { status: 504, expectedCode: "GATEWAY_TIMEOUT" }
  ]) {
    const secret = `upstream-secret-${scenario.status}`;
    const error = new HttpError(scenario.status, `internal dependency failure ${secret}`, {
      code: `PRIVATE_${scenario.status}`,
      details: { secret }
    });

    await withErrorServer(error, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/failure`);
      const body = await json(response);
      const serialized = JSON.stringify(body);

      assert.equal(response.status, scenario.status);
      assert.equal(body.success, false);
      assert.equal(body.error?.code, scenario.expectedCode);
      assert.doesNotMatch(serialized, new RegExp(secret));
      assert.doesNotMatch(serialized, new RegExp(`PRIVATE_${scenario.status}`));
    });
  }
});

test("server errors stay sanitized even when a caller requests exposure", async () => {
  const error = new HttpError(503, "private service diagnostic", {
    code: "PRIVATE_SERVICE_DIAGNOSTIC",
    details: { secret: "must-not-leak" },
    expose: true
  });

  await withErrorServer(error, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/failure`);
    const body = await json(response);
    const serialized = JSON.stringify(body);

    assert.equal(response.status, 503);
    assert.equal(body.error?.code, "SERVICE_UNAVAILABLE");
    assert.doesNotMatch(serialized, /private service diagnostic|PRIVATE_SERVICE_DIAGNOSTIC|must-not-leak/);
  });
});

test("non-canonical HttpError status codes collapse to the sanitized 500 contract", async () => {
  const error = new HttpError(418, "teapot details must not become an API contract", {
    code: "TEAPOT"
  });

  await withErrorServer(error, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/failure`);
    const body = await json(response);

    assert.equal(response.status, 500);
    assert.equal(body.error?.code, "INTERNAL_SERVER_ERROR");
    assert.equal(body.message, "An unexpected error occurred.");
  });
});
