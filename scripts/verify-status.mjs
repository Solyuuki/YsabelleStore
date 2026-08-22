import { getBranch } from "./lib/git-utils.mjs";
import { resolveMember } from "./lib/member-utils.mjs";
import { runAndPrint } from "./lib/run-command.mjs";
import { runSteps } from "./lib/workflow-runner.mjs";

const branch = getBranch();
const member = resolveMember(branch);
const steps = [{ args: ["run", "format:check"], command: "npm", label: "format check" }];

if (member) {
  steps.push({
    args: ["run", "artifact-check", "--", "--member", member.key],
    command: "npm",
    label: `implementation artifact check (${member.key})`
  });
}

steps.push(
  {
    args: ["run", "sprint-check"],
    command: "npm",
    label: "sprint status check"
  },
  { args: ["run", "version:check"], command: "npm", label: "version consistency" }
);

console.log("YsabelleStore Read-Only Status Verification");
console.log(`branch: ${branch}`);
console.log(`scope: ${member?.key ?? "sprint-integration"}`);
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
