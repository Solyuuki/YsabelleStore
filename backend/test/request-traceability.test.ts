import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { test } from "node:test";

import express from "express";

import { errorHandler } from "../src/middleware/errorHandler.js";
import { requestTrace } from "../src/middleware/requestTrace.js";
import { requestAuditLogger } from "../src/middleware/requestAuditLogger.js";

type FailureBody = {
  error?: {
    code?: string;
    details?: {
      requestId?: string;
    } | null;
  };
};

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const app = express();
  app.use(requestTrace);
  app.use(requestAuditLogger);
  app.get("/failure/:id", (_request, _response, next) => {
    next(new Error("database password=super-secret token=private-token"));
  });
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
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test("server errors expose only a request identifier that correlates with safe structured logs", async () => {
  const infoLogs: unknown[][] = [];
  const errorLogs: unknown[][] = [];
  const originalInfo = console.info;
  const originalError = console.error;
  console.info = (...args: unknown[]) => infoLogs.push(args);
  console.error = (...args: unknown[]) => errorLogs.push(args);

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/failure/42?password=query-secret`, {
        headers: {
          authorization: "Bearer private-token",
          cookie: "customer_session=private-cookie"
        }
      });
      const body = (await response.json()) as FailureBody;
      const headerRequestId = response.headers.get("x-request-id");

      assert.equal(response.status, 500);
      assert.ok(headerRequestId);
      assert.equal(body.error?.code, "INTERNAL_SERVER_ERROR");
      assert.equal(body.error?.details?.requestId, headerRequestId);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const combinedLogs = JSON.stringify([infoLogs, errorLogs]);
      assert.match(combinedLogs, new RegExp(headerRequestId));
      assert.doesNotMatch(
        combinedLogs,
        /super-secret|query-secret|private-token|private-cookie|authorization|cookie|password/i
      );
    });
  } finally {
    console.info = originalInfo;
    console.error = originalError;
  }
});
