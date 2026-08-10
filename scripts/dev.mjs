import { spawn, spawnSync } from "node:child_process";
import net from "node:net";

import { displayUrl, isLoopback, resolveDevelopmentRuntime } from "./lib/runtime-config.mjs";

const ELECTRON_READY_MARKER = "YsabelleStore Electron renderer ready.";
const HTTP_READY_TIMEOUT_MS = 45_000;
const ELECTRON_READY_TIMEOUT_MS = 60_000;
const PORT_RELEASE_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 200;
const webOnly = process.argv.includes("--web-only");
const runtime = resolveDevelopmentRuntime();
const npmCliPath = process.env.npm_execpath;
const children = [];
let stopping = false;
let cleanupFinished = false;
let shutdownPromise;

if (!npmCliPath) {
  throw new Error("The development orchestrator must be started through npm.");
}

const shutdownSignals = ["SIGINT", "SIGTERM", "SIGHUP"];
if (process.platform === "win32") shutdownSignals.push("SIGBREAK");

for (const signal of shutdownSignals) {
  process.once(signal, () => {
    void shutdown(0, `Received ${signal}; stopping the YsabelleStore development environment.`);
  });
}

process.on("message", (message) => {
  if (message && typeof message === "object" && message.type === "shutdown") {
    void shutdown(0, "Validation requested a clean development shutdown.");
  }
});

process.once("exit", () => {
  if (cleanupFinished) return;

  for (const ownedChild of [...children].reverse()) {
    terminateOwnedProcessTree(ownedChild.process);
  }
});

try {
  await assertDevPortsAvailable();

  console.info("Starting YsabelleStore backend...");
  const backend = startWorkspace("backend");
  await waitForBackend(backend.process);

  console.info("Starting YsabelleStore web frontend...");
  const frontend = startWorkspace("frontend");
  await waitForFrontend(frontend.process);

  let electron;
  if (!webOnly) {
    console.info("Starting YsabelleStore Electron application...");
    electron = startWorkspace("electron", {
      environment: {
        ELECTRON_RENDERER_DEV_URL: runtime.frontendUrl
      },
      readyMarker: ELECTRON_READY_MARKER
    });
    await electron.ready;
  }

  console.info("");
  console.info("YsabelleStore development environment ready");
  console.info("");
  console.info(`Web:      ${displayUrl(runtime.frontendUrl)}`);
  console.info(`Backend:  ${displayUrl(runtime.apiBaseUrl)}`);
  console.info(`Electron: ${webOnly ? "not started (web-only mode)" : "running"}`);
  console.info("");
  console.info("Press Ctrl+C once to stop every process in this development stack.");
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown development startup error.";
  await shutdown(1, message);
}

function startWorkspace(workspace, options = {}) {
  const environment = { ...process.env, ...options.environment };
  delete environment.ELECTRON_RUN_AS_NODE;

  const captureOutput = Boolean(options.readyMarker);
  const child = spawn(process.execPath, [npmCliPath, "run", "dev", "--workspace", workspace], {
    cwd: process.cwd(),
    detached: process.platform !== "win32",
    env: environment,
    stdio: captureOutput ? ["inherit", "pipe", "pipe"] : "inherit",
    windowsHide: true
  });
  const ownedChild = { name: workspace, process: child };
  children.push(ownedChild);

  let ready = Promise.resolve();
  if (options.readyMarker && child.stdout && child.stderr) {
    ready = waitForOutputMarker(child, options.readyMarker, workspace);
  }

  child.once("error", (error) => {
    if (!stopping) {
      void shutdown(1, `Unable to start the ${workspace} process: ${error.message}`);
    }
  });
  child.once("exit", (code, signal) => {
    setImmediate(() => {
      if (stopping) return;

      const reason = signal ? `signal ${signal}` : `exit code ${code ?? "unknown"}`;
      void shutdown(
        code === 0 ? 0 : 1,
        `The ${workspace} process ended (${reason}); stopping the remaining development stack.`
      );
    });
  });

  return { ...ownedChild, ready };
}

function waitForOutputMarker(child, marker, label) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let output = "";
    const timeout = setTimeout(() => {
      finish(() => reject(new Error(`${label} did not become ready within 60 seconds.`)));
    }, ELECTRON_READY_TIMEOUT_MS);

    const inspect = (chunk, target) => {
      target.write(chunk);
      if (settled) return;

      output = `${output}${chunk.toString()}`.slice(-8_192);

      if (stripAnsi(output).includes(marker)) {
        finish(resolve);
      }
    };
    const onStdout = (chunk) => inspect(chunk, process.stdout);
    const onStderr = (chunk) => inspect(chunk, process.stderr);
    const onExit = () => {
      finish(() => reject(new Error(`${label} exited before it became ready.`)));
    };

    child.stdout.on("data", onStdout);
    child.stderr.on("data", onStderr);
    child.once("exit", onExit);

    function finish(action) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.off("exit", onExit);
      action();
    }
  });
}

async function waitForBackend(child) {
  const healthUrl = new URL("/api/health", `${runtime.apiBaseUrl}/`);

  await waitForHttp(healthUrl, child, "backend", async (response) => {
    if (!response.ok) return false;
    const payload = await response.json();
    return payload?.data?.service === "ysabellestore-backend";
  });
}

async function waitForFrontend(child) {
  await waitForHttp(new URL(runtime.frontendUrl), child, "web frontend", async (response) => {
    if (!response.ok) return false;
    const html = await response.text();
    return html.includes('id="root"');
  });
}

async function waitForHttp(url, child, label, isReady) {
  const deadline = Date.now() + HTTP_READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`The ${label} process exited before ${url} became ready.`);
    }

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_500) });
      if (await isReady(response)) return;
    } catch {
      // The service is still starting; poll its readiness endpoint again.
    }

    await delay(POLL_INTERVAL_MS);
  }

  throw new Error(`The ${label} did not become ready at ${url} within 45 seconds.`);
}

async function assertDevPortsAvailable() {
  const checks = [
    {
      kind: "backend",
      port: runtime.backendPort,
      url: runtime.apiBaseUrl
    },
    {
      kind: "web frontend",
      port: runtime.frontendPort,
      url: runtime.frontendUrl
    }
  ];

  for (const check of checks) {
    if (!(await isPortOccupied(check.port, new URL(check.url).hostname))) continue;

    const owner = await identifyYsabelleService(check.kind, check.url);
    const detail = owner
      ? `an existing YsabelleStore ${owner} from another development stack`
      : "another process";
    throw new Error(
      `Port ${check.port} is already occupied by ${detail}. Unable to start the YsabelleStore ${check.kind}. Stop the owning process or stack first; no fallback port will be used.`
    );
  }
}

async function identifyYsabelleService(kind, baseUrl) {
  try {
    if (kind === "backend") {
      const response = await fetch(new URL("/api/health", `${baseUrl}/`), {
        signal: AbortSignal.timeout(1_000)
      });
      const payload = await response.json();
      return payload?.data?.service === "ysabellestore-backend" ? "backend" : null;
    }

    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1_000) });
    const html = await response.text();
    return html.includes('id="root"') && html.includes("YsabelleStore") ? "web frontend" : null;
  } catch {
    return null;
  }
}

function shutdown(exitCode, reason) {
  if (shutdownPromise) return shutdownPromise;

  shutdownPromise = (async () => {
    stopping = true;
    if (reason) console.info(`\n${reason}`);
    if (children.length > 0) console.info("Stopping owned development processes...");

    for (const ownedChild of [...children].reverse()) {
      terminateOwnedProcessTree(ownedChild.process);
    }

    await Promise.all(children.map((ownedChild) => waitForExit(ownedChild.process)));

    const portsReleased = children.length === 0 ? true : await waitForPortsReleased();
    if (!portsReleased) {
      console.error(
        `Shutdown completed, but port ${runtime.backendPort} or ${runtime.frontendPort} is still occupied by a process outside this stack.`
      );
      exitCode = 1;
    } else if (children.length > 0) {
      console.info(
        `YsabelleStore development environment stopped; ports ${runtime.backendPort} and ${runtime.frontendPort} are released.`
      );
    }

    cleanupFinished = true;
    process.exit(exitCode);
  })();

  return shutdownPromise;
}

function terminateOwnedProcessTree(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true
    });
    return;
  }

  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    // The process group already exited.
  }
}

async function waitForExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;

  await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(5_000)]);
}

async function waitForPortsReleased() {
  const deadline = Date.now() + PORT_RELEASE_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const [backendOccupied, frontendOccupied] = await Promise.all([
      isPortOccupied(runtime.backendPort, new URL(runtime.apiBaseUrl).hostname),
      isPortOccupied(runtime.frontendPort, new URL(runtime.frontendUrl).hostname)
    ]);

    if (!backendOccupied && !frontendOccupied) return true;
    await delay(POLL_INTERVAL_MS);
  }

  return false;
}

async function isPortOccupied(port, configuredHostname) {
  const hosts = isLoopback(configuredHostname)
    ? Array.from(new Set([configuredHostname, "127.0.0.1", "::1"]))
    : [configuredHostname];
  const results = await Promise.all(hosts.map((host) => canConnect(host, port)));
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

function stripAnsi(value) {
  return value.replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
