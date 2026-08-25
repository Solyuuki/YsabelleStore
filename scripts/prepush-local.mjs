import { getBranch } from "./lib/git-utils.mjs";
import { requireMember } from "./lib/member-utils.mjs";
import { createPrepushPlan } from "./lib/prepush-plan.mjs";
import { runAndPrint } from "./lib/run-command.mjs";
import { runSteps } from "./lib/workflow-runner.mjs";

const branch = getBranch();
const member = requireMember(branch);
const steps = createPrepushPlan({ memberKey: member.key });

console.log("YsabelleStore Local Pre-Push Workflow\n");
console.log(`Resolved member: ${member.key}`);

const result = runSteps(
  steps,
  (step) => runAndPrint(step.command, step.args),
  (step) => console.log(`\nRunning ${step.label}...`)
);

if (!result.ok) {
  console.error("\nFAIL: Not ready to push.");
  console.error(`Failed step: ${result.failedStep}`);
  console.error(
    "Next action: fix the reported issue, rerun npm run prepush:local, then review git status."
  );
  process.exit(result.status);
}

console.log("\nPASS: Local pre-push guardrails completed.");
console.log(
  "Review generated markdown, then run git status, git add, git commit, and git push manually."
);
