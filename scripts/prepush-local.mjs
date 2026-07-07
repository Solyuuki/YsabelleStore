import { runAndPrint } from "./lib/run-command.mjs";

const steps = [
  ["artifact-update", ["run", "artifact-update", "--", "--validation", "Pending"]],
  ["sprint-update", ["run", "sprint-update", "--", "--validation", "Pending"]],
  ["artifact-check", ["run", "artifact-check"]],
  ["sprint-check", ["run", "sprint-check"]],
  ["push-ready", ["run", "push-ready"]],
  ["artifact-update passed", ["run", "artifact-update", "--", "--validation", "Passed"]],
  ["sprint-update passed", ["run", "sprint-update", "--", "--validation", "Passed"]],
  ["format generated markdown", ["run", "format"]],
  ["artifact-check final", ["run", "artifact-check"]],
  ["sprint-check final", ["run", "sprint-check"]]
];

console.log("YsabelleStore Local Pre-Push Workflow\n");

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
