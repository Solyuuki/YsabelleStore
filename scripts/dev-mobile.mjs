import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import os from "node:os";

import { isLoopback, resolveDevelopmentRuntime } from "./lib/runtime-config.mjs";

const MOBILE_PORT = 5174;
const MOBILE_ORIGIN = "http://localhost:" + MOBILE_PORT;
const PREVIEW_PATH = "/mobile-preview.html";
const READY_TIMEOUT_MS = 130_000;
const runtime = resolveDevelopmentRuntime();
const npmCli = process.env.npm_execpath;
const noOpen = process.argv.includes("--no-open");
let ownedStack = null;
let ownedPreview = null;
let stopping = false;

if (!npmCli) throw new Error("Run the mobile preview through npm.");
if (!isLoopback(new URL(runtime.apiBaseUrl).hostname)) {
  throw new Error("dev:mob only supports a local development backend. Remote proxies are blocked.");
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.once(signal, () => void shutdown(0, "Stopping mobile preview."));
}
if (process.platform === "win32") {
  process.once("SIGBREAK", () => void shutdown(0, "Stopping mobile preview."));
}
process.once("exit", () => {
  if (ownedPreview && !hasExited(ownedPreview)) terminateTree(ownedPreview.pid);
});

try {
  const existing = await probePreview();
  if (existing === "ready") {
    console.info("YsabelleStore mobile preview is already running.");
    printLinks();
    if (!noOpen) openBrowser(MOBILE_ORIGIN + PREVIEW_PATH);
  } else {
    if (existing === "occupied") {
      throw new Error("Port 5174 is occupied by another service. Stop it first.");
    }

    const state = await probeStack();
    if (state === "partial") {
      throw new Error(
        "The shared backend could not be verified. See the backend diagnostics above, then run npm run runtime:report; leave unrelated frontend processes running."
      );
    }
    if (state === "none") {
      console.info("Starting the standard YsabelleStore web/backend stack once...");
      const preflight = spawnSync(process.execPath, [npmCli, "run", "predev:web"], {
        cwd: process.cwd(),
        env: process.env,
        stdio: "inherit",
        windowsHide: true
      });
      if (preflight.error || preflight.status !== 0) {
        throw new Error("The normal dev:web preflight failed.");
      }
      ownedStack = spawn(process.execPath, ["--env-file=.env", "scripts/dev.mjs", "--web-only"], {
        cwd: process.cwd(),
        env: process.env,
        stdio: ["inherit", "inherit", "inherit", "ipc"],
        windowsHide: true
      });
      await waitUntil(async () => (await probeStack()) === "backend-only", ownedStack, "Web/backend stack");
    } else if (state === "backend-only") {
      console.info("Reusing the healthy YsabelleStore backend and database.");
      console.info("Mobile frontend runs independently on port 5174; port 5173 is optional.");
    } else {
      console.info("Reusing the existing YsabelleStore web server, backend, and database.");
    }

    console.info("Starting mobile Vite frontend on port 5174...");
    ownedPreview = spawn(process.execPath, [npmCli, "run", "dev", "--workspace", "frontend"], {
      cwd: process.cwd(),
      detached: process.platform !== "win32",
      env: {
        ...process.env,
        YSABELLE_MOBILE_PREVIEW: "1",
        VITE_MOBILE_PREVIEW: "1"
      },
      stdio: "inherit",
      windowsHide: true
    });
    await waitUntil(async () => (await probePreview()) === "ready", ownedPreview, "Mobile preview");
    const response = await fetch(MOBILE_ORIGIN + "/api/health", {
      signal: AbortSignal.timeout(5_000)
    });
    const health = await response.json();
    if (!response.ok || health?.data?.service !== "ysabellestore-backend") {
      throw new Error("The mobile /api proxy is not connected to the YsabelleStore backend.");
    }

    console.info("");
    console.info("YsabelleStore mobile development environment ready");
    printLinks();
    console.info("Shared API proxy: /api -> " + runtime.apiBaseUrl);
    console.info("No duplicate backend or development database was created.");
    console.info("Only use this preview on a trusted LAN. Do not port-forward 5174.");
    console.info("Phone camera scanning may require a trusted HTTPS origin.");
    console.info("Ctrl+C stops the mobile preview" + (ownedStack ? " and the web stack it started." : "; the existing stack stays running."));
    if (!noOpen) openBrowser(MOBILE_ORIGIN + PREVIEW_PATH);

    await new Promise((resolve) => {
      ownedPreview.once("exit", resolve);
      ownedStack?.once("exit", resolve);
    });
    if (!stopping) throw new Error("A mobile-preview-owned development process exited unexpectedly.");
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  await shutdown(1);
}
if (ownedPreview || ownedStack) await shutdown(process.exitCode ?? 0);

async function probeStack() {
  // Verify the backend by its HTTP identity, not an IPv4/IPv6-dependent TCP probe.
  // Port 5173 is not a dependency of mobile Vite, even if another web server owns it.
  try {
    const response = await fetch(new URL("/api/health", runtime.apiBaseUrl + "/"), {
      signal: AbortSignal.timeout(4000)
    });
    const payload = await response.json();
    if (response.ok && payload?.data?.service === "ysabellestore-backend") {
      if (payload?.data?.checks?.database !== "connected") {
        console.error("YsabelleStore backend is online, but the database is not connected.");
        return "partial";
      }
      return "backend-only";
    }
    console.error(
      "Backend identity check failed:",
      "HTTP " + response.status,
      "service=" + String(payload?.data?.service ?? "unknown")
    );
  } catch (error) {
    console.info(
      "Backend HTTP check:",
      error instanceof Error ? error.message : "not reachable"
    );
  }

  // Only decide whether to start an owned stack after the HTTP probe fails.
  const [backendOccupied, frontendOccupied] = await Promise.all([
    occupied(runtime.backendPort, new URL(runtime.apiBaseUrl).hostname),
    occupied(runtime.frontendPort, new URL(runtime.frontendUrl).hostname)
  ]);
  if (!backendOccupied && !frontendOccupied) return "none";

  console.error(
    "Backend:", backendOccupied ? "port occupied but not verified" : "not listening",
    "| Web:", frontendOccupied ? "port 5173 in use" : "port 5173 free"
  );
  return "partial";
}

async function probePreview() {
  if (!(await occupied(MOBILE_PORT, "127.0.0.1"))) return "none";
  try {
    const response = await fetch(MOBILE_ORIGIN + PREVIEW_PATH, {
      signal: AbortSignal.timeout(1500)
    });
    return response.ok && (await response.text()).includes("Ysabelle MPOS Mobile Preview")
      ? "ready"
      : "occupied";
  } catch {
    return "occupied";
  }
}

function occupied(port, host) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    const finish = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(900);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
  });
}

async function waitUntil(probe, child, label) {
  const expires = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < expires) {
    if (hasExited(child)) throw new Error(label + " exited before it became ready.");
    if (await probe()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(label + " did not become ready before the timeout.");
}

function hasExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

function printLinks() {
  console.info("Desktop mobile preview: " + MOBILE_ORIGIN + PREVIEW_PATH);
  console.info("Desktop direct app:     " + MOBILE_ORIGIN + "/");
  const ips = new Set();
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== "IPv4" || address.internal) continue;
      const ip = address.address;
      if (
        ip.startsWith("10.") ||
        ip.startsWith("192.168.") ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
      ) ips.add(ip);
    }
  }
  if (ips.size === 0) console.info("No private LAN IPv4 detected; check Wi-Fi.");
  for (const ip of ips) console.info("Phone on same Wi-Fi: http://" + ip + ":" + MOBILE_PORT + "/");
}

function openBrowser(url) {
  try {
    let command;
    let args;
    if (process.platform === "win32") {
      command = "cmd.exe";
      args = ["/d", "/s", "/c", "start", '""', url];
    } else if (process.platform === "darwin") {
      command = "open";
      args = [url];
    } else {
      command = "xdg-open";
      args = [url];
    }
    const child = spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true });
    child.on("error", () => {
      console.info("Open the preview URL above manually if no browser launched.");
    });
    child.unref();
  } catch {
    console.info("Open the preview URL above manually.");
  }
}

async function shutdown(code, reason) {
  if (stopping) return;
  stopping = true;
  if (reason) console.info(reason);
  if (ownedStack && !hasExited(ownedStack) && ownedStack.connected) {
    ownedStack.send({ type: "shutdown" });
  }
  if (ownedPreview && !hasExited(ownedPreview)) terminateTree(ownedPreview.pid);
  if (ownedStack && !hasExited(ownedStack)) {
    await Promise.race([
      new Promise((resolve) => ownedStack.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 6_000))
    ]);
    if (!hasExited(ownedStack)) terminateTree(ownedStack.pid);
  }
  process.exitCode = code;
}

function terminateTree(pid) {
  if (!pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true
    });
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // The process already stopped.
    }
  }
}
