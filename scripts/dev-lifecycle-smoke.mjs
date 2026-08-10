import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";

import { resolveDevelopmentRuntime } from "./lib/runtime-config.mjs";

const READY_MARKER = "Press Ctrl+C once to stop every process in this development stack.";
const runtime = resolveDevelopmentRuntime();
const npmCliPath = process.env.npm_execpath;
const snapshots = [];

if (!npmCliPath) {
  throw new Error("Run the lifecycle smoke test through npm.");
}

await assertPortsReleased("before lifecycle validation");

for (let cycle = 1; cycle <= 2; cycle += 1) {
  snapshots.push(await runCycle({ cycle, webOnly: false }));
}

snapshots.push(await runCycle({ cycle: 1, webOnly: true }));
await testOccupiedPortFailure();

for (const snapshot of snapshots.slice(1)) {
  assert.deepEqual(snapshot, snapshots[0], "Storefront data changed between lifecycle cycles.");
}

console.log(
  `Lifecycle validation passed: two full dev cycles, one web-only cycle, and unrelated-port rejection; products=${snapshots[0].productCount}; categories=${snapshots[0].categoryCount}.`
);

async function testOccupiedPortFailure() {
  const blocker = net.createServer((socket) => socket.destroy());
  await new Promise((resolve, reject) => {
    blocker.once("error", reject);
    blocker.listen(runtime.frontendPort, "localhost", resolve);
  });

  const child = spawn(process.execPath, ["--env-file=.env", "scripts/dev.mjs"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    windowsHide: true
  });
  const exit = new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  try {
    const result = await withTimeout(
      exit,
      10_000,
      "Occupied-port validation did not exit within 10 seconds."
    );
    assert.equal(result.code, 1, `Occupied-port validation exited with ${result.code}.`);
    assert.match(
      output,
      new RegExp(
        `Port ${runtime.frontendPort} is already occupied by another process\\. Unable to start the YsabelleStore web frontend\\.`
      )
    );
  } finally {
    if (child.exitCode === null && child.signalCode === null) terminateProcessTree(child.pid);
    await new Promise((resolve, reject) => {
      blocker.close((error) => (error ? reject(error) : resolve()));
    });
  }

  await assertPortsReleased("after occupied-port validation");
  console.log("unrelated-port rejection: actionable fixed-port failure passed.");
}

async function runCycle({ cycle, webOnly }) {
  const label = webOnly ? "dev:web" : `dev restart cycle ${cycle}`;
  const args = ["--env-file=.env", "scripts/dev.mjs"];
  if (webOnly) args.push("--web-only");

  const environment = { ...process.env, YSABELLE_DEV_SMOKE: "1" };
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: environment,
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    windowsHide: true
  });
  let output = "";
  let ready = false;
  const exit = new Promise((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  const readiness = new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`${label} did not become ready within 90 seconds.\n${output}`)),
      90_000
    );
    const inspect = (chunk, target) => {
      target.write(chunk);
      output = `${output}${chunk.toString()}`.slice(-65_536);

      if (!ready && stripAnsi(output).includes(READY_MARKER)) {
        ready = true;
        clearTimeout(timeout);
        resolve();
      }
    };

    child.stdout.on("data", (chunk) => inspect(chunk, process.stdout));
    child.stderr.on("data", (chunk) => inspect(chunk, process.stderr));
    child.once("exit", (code, signal) => {
      if (ready) return;
      clearTimeout(timeout);
      reject(
        new Error(`${label} exited before readiness (code=${code}, signal=${signal}).\n${output}`)
      );
    });
  });

  try {
    await readiness;
    assert.match(output, new RegExp(`Web:\\s+${escapeRegExp(`${runtime.frontendUrl}/`)}`));
    assert.match(output, new RegExp(`Backend:\\s+${escapeRegExp(`${runtime.apiBaseUrl}/`)}`));
    assert.match(
      output,
      webOnly ? /Electron:\s+not started \(web-only mode\)/ : /Electron:\s+running/
    );

    const snapshot = await readAndCompareStorefront();
    child.send({ type: "shutdown" });

    const result = await withTimeout(exit, 20_000, `${label} did not stop within 20 seconds.`);
    assert.equal(result.code, 0, `${label} exited with code ${result.code} (${result.signal}).`);
    await assertPortsReleased(`after ${label}`);
    console.log(`${label}: clean start and shutdown passed.`);
    return snapshot;
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      if (child.connected) child.send({ type: "shutdown" });
      await Promise.race([exit, delay(5_000)]);
    }

    if (child.exitCode === null && child.signalCode === null) {
      terminateProcessTree(child.pid);
    }

    await assertPortsReleased(`during ${label} cleanup`);
  }
}

async function readAndCompareStorefront() {
  const [health, browser, electron] = await Promise.all([
    fetch(new URL("/api/health", `${runtime.apiBaseUrl}/`), {
      signal: AbortSignal.timeout(10_000)
    }).then((response) => response.json()),
    readStorefront(runtime.frontendUrl),
    readStorefront("null")
  ]);

  assert.equal(health?.data?.service, "ysabellestore-backend");
  assert.equal(health?.data?.checks?.database, "connected");
  assert.deepEqual(electron, browser, "Browser and Electron storefront data diverged.");

  const webResponse = await fetch(runtime.frontendUrl, { signal: AbortSignal.timeout(10_000) });
  assert.equal(webResponse.ok, true);
  assert.match(await webResponse.text(), /id="root"/);

  return browser;
}

async function readStorefront(origin) {
  const [productsResponse, categoriesResponse] = await Promise.all([
    fetch(new URL("/api/storefront/products?page=1&pageSize=5", `${runtime.apiBaseUrl}/`), {
      headers: { Origin: origin },
      signal: AbortSignal.timeout(10_000)
    }),
    fetch(new URL("/api/storefront/categories", `${runtime.apiBaseUrl}/`), {
      headers: { Origin: origin },
      signal: AbortSignal.timeout(10_000)
    })
  ]);
  assert.equal(productsResponse.headers.get("access-control-allow-origin"), origin);
  assert.equal(categoriesResponse.headers.get("access-control-allow-origin"), origin);

  const products = await productsResponse.json();
  const categories = await categoriesResponse.json();
  assert.equal(products.success, true);
  assert.equal(categories.success, true);

  return {
    productCount: products.meta?.totalItems ?? products.data.length,
    categoryCount: categories.data.length,
    samples: products.data.map((product) => ({
      id: product.id,
      name: product.name,
      sellingPrice: product.sellingPrice,
      availableStock: product.availableStock,
      imageUrl: product.imageUrl ?? null,
      category: product.category
    }))
  };
}

async function assertPortsReleased(context) {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    const occupied = await Promise.all([
      portOccupied(runtime.backendPort),
      portOccupied(runtime.frontendPort)
    ]);
    if (occupied.every((value) => !value)) return;
    await delay(200);
  }

  throw new Error(
    `Expected ports ${runtime.backendPort} and ${runtime.frontendPort} to be released ${context}.`
  );
}

async function portOccupied(port) {
  const results = await Promise.all(["127.0.0.1", "::1"].map((host) => canConnect(host, port)));
  return results.some(Boolean);
}

function canConnect(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (connected) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(connected);
    };

    socket.setTimeout(500);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
  });
}

function terminateProcessTree(processId) {
  if (!processId) return;

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(processId), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true
    });
    return;
  }

  try {
    process.kill(processId, "SIGTERM");
  } catch {
    // The validation process already exited.
  }
}

function withTimeout(promise, milliseconds, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), milliseconds))
  ]);
}

function stripAnsi(value) {
  return value.replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
