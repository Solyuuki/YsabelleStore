import { spawn } from "node:child_process";
import process from "node:process";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const RESET = "\x1b[0m";
const PASS_ICON = "\u2705";
const FAIL_ICON = "\u274c";

const npmCommand = "npm";
const useShell = process.platform === "win32";

const checks = [
  {
    name: "Format",
    command: "npm run format",
    args: ["run", "format"]
  },
  {
    name: "Format Check",
    command: "npm run format:check",
    args: ["run", "format:check"]
  },
  {
    name: "Lint",
    command: "npm run lint",
    args: ["run", "lint"]
  },
  {
    name: "Frontend Typecheck",
    command: "npm run typecheck --workspace frontend",
    args: ["run", "typecheck", "--workspace", "frontend"]
  },
  {
    name: "Backend Typecheck",
    command: "npm run typecheck --workspace backend",
    args: ["run", "typecheck", "--workspace", "backend"]
  },
  {
    name: "Electron Typecheck",
    command: "npm run typecheck --workspace electron",
    args: ["run", "typecheck", "--workspace", "electron"]
  },
  {
    name: "Build",
    command: "npm run build",
    args: ["run", "build"]
  },
  {
    name: "Security Audit",
    command: "npm audit --audit-level=high",
    args: ["audit", "--audit-level=high"]
  }
];

function formatDuration(milliseconds) {
  const seconds = milliseconds / 1000;

  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  return `${minutes}m ${remainingSeconds}s`;
}

function runCheck(check) {
  return new Promise((resolve) => {
    const startedAt = Date.now();

    console.log(`\n> ${check.command}\n`);

    let child;

    try {
      child = useShell
        ? spawn(check.command, [], {
            stdio: "inherit",
            shell: true
          })
        : spawn(npmCommand, check.args, {
            stdio: "inherit",
            shell: false
          });
    } catch (error) {
      const duration = Date.now() - startedAt;

      console.error(`${RED}Failed to start ${check.command}: ${error.message}${RESET}`);
      resolve({
        ...check,
        passed: false,
        duration
      });
      return;
    }

    child.on("error", (error) => {
      const duration = Date.now() - startedAt;

      console.error(`${RED}Failed to start ${check.command}: ${error.message}${RESET}`);
      resolve({
        ...check,
        passed: false,
        duration
      });
    });

    child.on("close", (code) => {
      const duration = Date.now() - startedAt;

      resolve({
        ...check,
        passed: code === 0,
        duration
      });
    });
  });
}

function statusLabel(passed) {
  return passed ? `${GREEN}${PASS_ICON} PASS${RESET}` : `${RED}${FAIL_ICON} FAIL${RESET}`;
}

function printReport(results) {
  console.log("\nYSABELLESTORE HEALTHCHECK REPORT\n");
  console.log("| Check | Status | Duration |");
  console.log("|---|---:|---:|");

  for (const result of results) {
    console.log(
      `| ${result.name} | ${statusLabel(result.passed)} | ${formatDuration(result.duration)} |`
    );
  }

  const passed = results.every((result) => result.passed);

  console.log("\nFinal Verdict:");
  console.log(
    passed
      ? `${GREEN}${PASS_ICON} HEALTHCHECK PASSED${RESET}`
      : `${RED}${FAIL_ICON} HEALTHCHECK FAILED${RESET}`
  );

  return passed;
}

const results = [];

for (const check of checks) {
  results.push(await runCheck(check));
}

const passed = printReport(results);

process.exitCode = passed ? 0 : 1;
