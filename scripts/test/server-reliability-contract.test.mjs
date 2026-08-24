import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync("backend/src/app.ts", "utf8");
const errorHandlerSource = fs.readFileSync("backend/src/middleware/errorHandler.ts", "utf8");
const requestLoggerSource = fs.readFileSync("backend/src/middleware/requestAuditLogger.ts", "utf8");
const healthServiceSource = fs.readFileSync("frontend/src/services/systemHealthService.ts", "utf8");

test("request tracing stays ahead of API routing and error handling", () => {
  const traceIndex = appSource.indexOf("app.use(requestTrace)");
  const loggerIndex = appSource.indexOf("app.use(requestAuditLogger)");
  const routerIndex = appSource.indexOf('app.use("/api", router)');
  const errorIndex = appSource.indexOf("app.use(errorHandler)");

  assert.ok(traceIndex >= 0);
  assert.ok(loggerIndex > traceIndex);
  assert.ok(routerIndex > loggerIndex);
  assert.ok(errorIndex > routerIndex);
});

test("server error responses remain generic and correlation-safe", () => {
  assert.match(errorHandlerSource, /INTERNAL_SERVER_ERROR/);
  assert.match(errorHandlerSource, /An unexpected error occurred\./);
  assert.match(errorHandlerSource, /requestId/);
  assert.doesNotMatch(errorHandlerSource, /console\.error\(error\)/);
});

test("structured request logs exclude sensitive request containers", () => {
  assert.match(requestLoggerSource, /requestId/);
  assert.match(requestLoggerSource, /method/);
  assert.match(requestLoggerSource, /path/);
  assert.doesNotMatch(
    requestLoggerSource,
    /request\.(headers|body|query|cookies)|authorization|password|token/i
  );
});

test("frontend health classification keeps all Sprint 8 reliability states", () => {
  for (const state of [
    "healthy",
    "degraded",
    "database-unavailable",
    "backend-unavailable",
    "timeout",
    "offline"
  ]) {
    assert.match(healthServiceSource, new RegExp(state));
  }
});
