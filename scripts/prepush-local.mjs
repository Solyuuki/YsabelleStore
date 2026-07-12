import { runAndPrint } from "./lib/run-command.mjs";
import { getBranch } from "./lib/git-utils.mjs";
import { requireMember } from "./lib/member-utils.mjs";

const branch = getBranch();
const member = requireMember(branch);
const memberArgs = ["--", "--member", member.key];
const steps = [
  ["artifact-update", ["run", "artifact-update", ...memberArgs, "--validation", "Pending"]],
  ["sprint-update", ["run", "sprint-update", ...memberArgs, "--validation", "Pending"]],
  ["artifact-check", ["run", "artifact-check", ...memberArgs]],
  ["sprint-check", ["run", "sprint-check", ...memberArgs]],
  ["push-ready", ["run", "push-ready", ...memberArgs]],
  ["artifact-update passed", ["run", "artifact-update", ...memberArgs, "--validation", "Passed"]],
  ["sprint-update passed", ["run", "sprint-update", ...memberArgs, "--validation", "Passed"]],
  ["format generated markdown", ["run", "format"]],
  ["artifact-check final", ["run", "artifact-check", ...memberArgs]],
  ["sprint-check final", ["run", "sprint-check", ...memberArgs]]
];

console.log("YsabelleStore Local Pre-Push Workflow\n");
console.log(`Resolved member: ${member.key}`);

for (const [label, args] of steps) {
  console.log(`\nRunning ${label}...`);
  const result = runAndPrint("npm", args);

  if (!result.ok) {
    console.error("\nFAIL: Not ready to push.");
    console.error(`Failed step: ${label}`);
    console.error(
      "Next action: fix the reported issue, rerun npm run prepush:local, then review git status."
    );
    process.exit(result.status);
  }
}

console.log("\nPASS: Ready to push");
console.log(
  "Review generated markdown, then run git status, git add, git commit, and git push manually."
);
