import { runAndPrint } from "./lib/run-command.mjs";
import { runSteps } from "./lib/workflow-runner.mjs";

const memberIndex = process.argv.indexOf("--member");
const member = memberIndex >= 0 ? process.argv[memberIndex + 1] : null;
const memberArgs = member ? ["--", "--member", member] : [];
const steps = [
  { args: ["run", "verify:code"], command: "npm", label: "code verification" },
  {
    args: ["run", "verify:status", ...memberArgs],
    command: "npm",
    label: "status verification"
  }
];

console.log("YsabelleStore Complete Read-Only Local Verification");
const result = runSteps(
  steps,
  (step) => runAndPrint(step.command, step.args),
  (step) => {
    console.log(`\nRunning ${step.label}...`);
  }
);

if (!result.ok) {
  console.error(`\nFAIL: ${result.failedStep}`);
  process.exit(result.status);
}

console.log("\nPASS: Complete local verification passed.");
