import fs from "node:fs";
import path from "node:path";

import { runAndPrint, runCommand } from "./lib/run-command.mjs";

console.log("Prisma clean may stop running dev servers to prevent Windows EPERM file locks.");

if (process.platform === "win32") {
  stopWindowsProcesses();
} else {
  console.log("Non-Windows platform detected; skipping Windows process cleanup.");
}

const prismaClientDir = path.join(process.cwd(), "node_modules", ".prisma");

if (fs.existsSync(prismaClientDir)) {
  fs.rmSync(prismaClientDir, {
    force: true,
    recursive: true
  });
  console.log(`Removed ${prismaClientDir}`);
} else {
  console.log("No node_modules/.prisma directory found.");
}

const generate = runAndPrint("npm", ["run", "prisma:generate"]);

if (!generate.ok) {
  console.error("\nPrisma generate failed.");
  console.error("Suggested fix:");
  console.error("- close dev server");
  console.error("- close Electron");
  console.error("- close VS Code if needed");
  console.error("- restart terminal");
  console.error("- rerun npm run prisma:clean");
  process.exit(generate.status);
}

console.log("Prisma clean completed.");

function stopWindowsProcesses() {
  const cwd = process.cwd().toLowerCase();
  const list = runCommand("powershell", [
    "-NoProfile",
    "-Command",
    "Get-CimInstance Win32_Process | Where-Object { $_.Name -in @('node.exe','electron.exe') } | Select-Object ProcessId,Name,CommandLine | ConvertTo-Json -Compress"
  ]);

  if (!list.ok || !list.stdout.trim()) {
    console.log("No node.exe or electron.exe process list available.");
    return;
  }

  const parsed = JSON.parse(list.stdout);
  const processes = Array.isArray(parsed) ? parsed : [parsed];
  const targets = processes.filter((processInfo) => shouldStopProcess(processInfo, cwd));

  if (targets.length === 0) {
    console.log("No local dev server or Electron processes found to stop.");
    return;
  }

  for (const processInfo of targets) {
    const result = runCommand("taskkill", ["/F", "/T", "/PID", String(processInfo.ProcessId)]);
    const label = `${processInfo.Name} ${processInfo.ProcessId}`;
    console.log(result.ok ? `Stopped ${label}` : `Could not stop ${label}; continuing.`);
  }
}

function shouldStopProcess(processInfo, cwd) {
  const pid = Number(processInfo.ProcessId);
  const commandLine = String(processInfo.CommandLine ?? "").toLowerCase();

  if (!pid || pid === process.pid || pid === process.ppid) {
    return false;
  }

  if (processInfo.Name === "electron.exe") {
    return true;
  }

  if (!commandLine.includes(cwd)) {
    return false;
  }

  if (
    /scripts[\\/](prisma-clean|push-ready|prepush-local|artifact-update|sprint-update|artifact-check|sprint-check|healthcheck)\.mjs/.test(
      commandLine
    )
  ) {
    return false;
  }

  return /npm-cli\.js.*run dev|concurrently|vite|tsx.*watch|electron[\\/](cli|dist)|src[\\/]server\.ts/.test(
    commandLine
  );
}
