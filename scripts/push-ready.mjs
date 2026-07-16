import { getBranch } from "./lib/git-utils.mjs";
import { requireMember } from "./lib/member-utils.mjs";
import { runAndPrint } from "./lib/run-command.mjs";
import { writeValidationSummary } from "./lib/validation-summary.mjs";

const branch = getBranch();
const member = requireMember(branch);
const steps = [
  ["npm run format", "npm", ["run", "format"]],
  ["npm run format:check", "npm", ["run", "format:check"]],
  ["npm run lint", "npm", ["run", "lint"]],
  [
    "npm run typecheck --workspace frontend",
    "npm",
    ["run", "typecheck", "--workspace", "frontend"]
  ],
  ["npm run typecheck --workspace backend", "npm", ["run", "typecheck", "--workspace", "backend"]],
  [
    "npm run typecheck --workspace electron",
    "npm",
    ["run", "typecheck", "--workspace", "electron"]
  ],
  ["npm run build", "npm", ["run", "build"]],
  ["npm audit --audit-level=high", "npm", ["audit", "--audit-level=high"]]
];
const summaryRows = [];

console.log("YsabelleStore Push Ready Check\n");

for (const [index, step] of steps.entries()) {
  const [label, command, args] = step;
  console.log(`\n[${index + 1}/${steps.length}] ${label}`);

  const result = runAndPrint(command, args);

  if (!result.ok) {
    summaryRows.push({
      command: label,
      notes: `Failed with exit code ${result.status}.`,
      result: "Failed"
    });
    writeValidationSummary(member, branch, summaryRows);
    console.error("\nFinal Result:");
    console.error("FAIL: Not ready to push.");
    console.error("\nFailed step:");
    console.error(label);
    console.error("\nSuggested fix:");
    console.error(
      "If Prisma EPERM occurs, close the project dev server or Electron manually, then retry."
    );
    process.exit(result.status);
  }

  summaryRows.push({
    command: label,
    notes: "Completed successfully.",
    result: "Passed"
  });
  console.log("PASS");
}

writeValidationSummary(member, branch, summaryRows);
console.log("\nFinal Result:");
console.log("PASS: Ready to push.");
