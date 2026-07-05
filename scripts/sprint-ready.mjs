import { spawnSync } from "node:child_process";
import process from "node:process";

const PASS_ICON = "\u2705";
const FAIL_ICON = "\u274c";

const useShell = process.platform === "win32";

function parseArgs(argv) {
  const args = {};
  for (const item of argv) {
    if (!item.startsWith("--")) {
      continue;
    }
    const equalsIndex = item.indexOf("=");
    if (equalsIndex === -1) {
      args[item.slice(2)] = "true";
    } else {
      args[item.slice(2, equalsIndex)] = item.slice(equalsIndex + 1);
    }
  }
  return args;
}

function runStep(step, command, args) {
  console.log(`\n> ${command} ${args.join(" ")}\n`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: useShell
  });

  return {
    step,
    passed: result.status === 0,
    notes: result.status === 0 ? step.successNotes : "Check terminal output above"
  };
}

function printReport(results) {
  const passed = results.every((result) => result.passed);

  console.log("\nYSABELLESTORE SPRINT READY REPORT\n");
  console.log("| Step | Status | Notes |");
  console.log("| --- | ---: | --- |");
  for (const result of results) {
    console.log(
      `| ${result.step.name} | ${result.passed ? `${PASS_ICON} PASS` : `${FAIL_ICON} FAIL`} | ${result.notes} |`
    );
  }

  console.log("\nFinal Verdict:");
  console.log(passed ? `${PASS_ICON} SPRINT READY PASSED` : `${FAIL_ICON} SPRINT READY FAILED`);

  return passed;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const member = args.member;

  if (!["m1", "m2", "m3"].includes(member)) {
    console.error("Usage: npm run sprint:ready -- --member=m1");
    process.exit(1);
  }

  const steps = [
    {
      name: "Artifact Update",
      command: "npm",
      args: ["run", "artifacts:update", "--", `--member=${member}`],
      successNotes: "Sprint/member artifacts updated"
    },
    {
      name: "Stage Generated Artifacts",
      command: "git",
      args: ["add", "docs/sprints", "docs/implementation-artifacts"],
      successNotes: "Generated docs staged"
    },
    {
      name: "Artifact Check",
      command: "npm",
      args: ["run", "artifacts:check"],
      successNotes: "Artifact tracking requirement satisfied"
    },
    {
      name: "Healthcheck",
      command: "npm",
      args: ["run", "healthcheck"],
      successNotes: "Local validation checklist passed"
    }
  ];

  const results = [];

  for (const step of steps) {
    const result = runStep(step, step.command, step.args);
    results.push(result);

    if (!result.passed) {
      printReport(results);
      process.exit(1);
    }
  }

  process.exit(printReport(results) ? 0 : 1);
}

main();
