import { runAndPrint } from "./lib/run-command.mjs";
import { runSteps } from "./lib/workflow-runner.mjs";

const steps = [
  { args: ["diff", "--check"], command: "git", label: "git diff check" },
  { args: ["run", "prisma:validate"], command: "npm", label: "Prisma validation" },
  {
    args: ["run", "typecheck"],
    command: "npm",
    label: "workspace type checking"
  },
  { args: ["run", "lint"], command: "npm", label: "lint" },
  { args: ["run", "format:check"], command: "npm", label: "format check" },
  { args: ["run", "test:guardrails"], command: "npm", label: "guardrail regression tests" },
  {
    args: ["run", "repo:context:test"],
    command: "npm",
    label: "repository context regression tests"
  },
  {
    args: ["test", "--workspaces", "--if-present"],
    command: "npm",
    label: "workspace tests"
  },
  { args: ["run", "build"], command: "npm", label: "production build" },
  {
    args: ["run", "security:audit:production"],
    command: "npm",
    label: "production dependency audit"
  },
  { args: ["run", "version:check"], command: "npm", label: "version consistency" }
];

console.log("YsabelleStore Read-Only Code Verification");
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

console.log("\nPASS: Code verification completed without repository metadata mutation.");
