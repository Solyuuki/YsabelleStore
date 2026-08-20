import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import { test } from "node:test";

import { resolveDevelopmentRuntime } from "../lib/runtime-config.mjs";

const runtime = resolveDevelopmentRuntime();

async function startExistingWebStack() {
  const backend = http.createServer((request, response) => {
    if (request.url === "/api/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ data: { service: "ysabellestore-backend" } }));
      return;
    }

    response.writeHead(404);
    response.end();
  });
  const frontend = http.createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/html" });
    response.end('<!doctype html><html><body><div id="root">YsabelleStore</div></body></html>');
  });

  await Promise.all([listen(backend, runtime.backendPort), listen(frontend, runtime.frontendPort)]);

  return async () => {
    await Promise.all([close(backend), close(frontend)]);
  };
}

function runDev(args = []) {
  const child = spawn(process.execPath, ["--env-file=.env", "scripts/dev.mjs", ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  return {
    child,
    output: () => output,
    exit: new Promise((resolve) => {
      child.once("exit", (code, signal) => resolve({ code, signal }));
    })
  };
}

async function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), timeoutMs))
  ]);
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, resolve);
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test("dev:web treats an existing YsabelleStore web stack as already running", async () => {
  const stopWebStack = await startExistingWebStack();
  const run = runDev(["--web-only"]);

  try {
    const result = await withTimeout(run.exit, 10_000, "dev:web did not exit cleanly");
    assert.equal(result.code, 0);
    assert.match(run.output(), /YsabelleStore web development stack is already running/);
    assert.doesNotMatch(run.output(), /Assertion failed:/);
    assert.doesNotMatch(run.output(), /UV_HANDLE_CLOSING/);
  } finally {
    if (run.child.exitCode === null && run.child.signalCode === null) run.child.kill();
    await stopWebStack();
  }
});

test("dev refuses to start while the web development stack is already running", async () => {
  const stopWebStack = await startExistingWebStack();
  const run = runDev();

  try {
    const result = await withTimeout(run.exit, 10_000, "dev did not reject the active web stack");
    assert.equal(result.code, 1);
    assert.match(run.output(), /YsabelleStore web development stack is already running/);
    assert.match(run.output(), /Stop npm run dev:web before starting npm run dev/);
    assert.doesNotMatch(run.output(), /Starting YsabelleStore Electron application/);
    assert.doesNotMatch(run.output(), /Assertion failed:/);
    assert.doesNotMatch(run.output(), /UV_HANDLE_CLOSING/);

    const [backendResponse, frontendResponse] = await Promise.all([
      fetch(new URL("/api/health", `${runtime.apiBaseUrl}/`)),
      fetch(runtime.frontendUrl)
    ]);
    assert.equal(backendResponse.ok, true, "rejected dev command stopped the existing backend");
    assert.equal(frontendResponse.ok, true, "rejected dev command stopped the existing frontend");
  } finally {
    if (run.child.exitCode === null && run.child.signalCode === null) run.child.kill();
    await stopWebStack();
  }
});
