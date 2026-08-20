import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { resolveDevelopmentRuntime } from "../lib/runtime-config.mjs";

const runtime = resolveDevelopmentRuntime();
const READY_MARKER = "Press Ctrl+C once to stop every process in this development stack.";

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

async function createFakeNpmCli() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ysabelle-dev-mode-"));
  const cliPath = path.join(directory, "fake-npm.mjs");
  await writeFile(
    cliPath,
    `const args = process.argv.slice(2);\nif (args.join(" ") !== "run dev --workspace electron") {\n  console.error("Unexpected fake npm invocation:", args.join(" "));\n  process.exit(2);\n}\nconsole.log("YsabelleStore Electron renderer ready.");\nsetInterval(() => {}, 1000);\n`,
    "utf8"
  );

  return {
    cliPath,
    cleanup: () => rm(directory, { force: true, recursive: true })
  };
}

function runDev(args = [], environment = {}) {
  const child = spawn(process.execPath, ["--env-file=.env", "scripts/dev.mjs", ...args], {
    cwd: process.cwd(),
    env: { ...process.env, ...environment },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
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

async function waitForOutput(run, marker, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (run.output().includes(marker)) return;
    if (run.child.exitCode !== null || run.child.signalCode !== null) {
      throw new Error(`Development command exited before "${marker}".\n${run.output()}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for "${marker}".\n${run.output()}`);
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
  const fakeNpm = await createFakeNpmCli();
  const run = runDev(["--web-only"], { npm_execpath: fakeNpm.cliPath });

  try {
    const result = await withTimeout(run.exit, 10_000, "dev:web did not exit cleanly");
    assert.equal(result.code, 0);
    assert.match(run.output(), /YsabelleStore web development stack is already running/);
    assert.match(run.output(), new RegExp(runtime.frontendUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(run.output(), /Assertion failed:/);
    assert.doesNotMatch(run.output(), /UV_HANDLE_CLOSING/);
  } finally {
    if (run.child.exitCode === null && run.child.signalCode === null) run.child.kill();
    await fakeNpm.cleanup();
    await stopWebStack();
  }
});

test("dev reuses an existing web stack and owns only the Electron process", async () => {
  const stopWebStack = await startExistingWebStack();
  const fakeNpm = await createFakeNpmCli();
  const run = runDev([], { npm_execpath: fakeNpm.cliPath });

  try {
    await waitForOutput(run, READY_MARKER);
    assert.match(run.output(), /Reusing existing YsabelleStore web development stack/);
    assert.match(run.output(), /Electron:\s+running/);
    assert.doesNotMatch(run.output(), /Starting YsabelleStore backend/);
    assert.doesNotMatch(run.output(), /Starting YsabelleStore web frontend/);

    run.child.send({ type: "shutdown" });
    const result = await withTimeout(run.exit, 10_000, "dev did not stop cleanly");
    assert.equal(result.code, 0);

    const [backendResponse, frontendResponse] = await Promise.all([
      fetch(new URL("/api/health", `${runtime.apiBaseUrl}/`)),
      fetch(runtime.frontendUrl)
    ]);
    assert.equal(backendResponse.ok, true, "dev stopped the web-only backend it did not own");
    assert.equal(frontendResponse.ok, true, "dev stopped the web-only frontend it did not own");
    assert.doesNotMatch(run.output(), /Assertion failed:/);
    assert.doesNotMatch(run.output(), /UV_HANDLE_CLOSING/);
  } finally {
    if (run.child.exitCode === null && run.child.signalCode === null) run.child.kill();
    await fakeNpm.cleanup();
    await stopWebStack();
  }
});
