import { getBranch } from "./lib/git-utils.mjs";
import { requireMember } from "./lib/member-utils.mjs";
import { runAndPrint } from "./lib/run-command.mjs";
import { runSteps } from "./lib/workflow-runner.mjs";

const member = requireMember(getBranch());
const memberArgs = ["--", "--member", member.key];
const steps = [
  { args: ["run", "format:check"], command: "npm", label: "format check" },
  {
    args: ["run", "artifact-check", ...memberArgs],
    command: "npm",
    label: "implementation artifact check"
  },
  {
    args: ["run", "sprint-check", ...memberArgs],
    command: "npm",
    label: "sprint status check"
  },
  { args: ["run", "version:check"], command: "npm", label: "version consistency" }
];

console.log("YsabelleStore Read-Only Status Verification");
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

console.log("\nPASS: Status verification completed without file mutation.");
