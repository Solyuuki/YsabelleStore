import path from "node:path";

import { withFileTransaction } from "./lib/file-transaction.mjs";
import { getBranch } from "./lib/git-utils.mjs";
import { loadGuardrailContext } from "./lib/guardrail-config.mjs";
import {
  artifactDir,
  getRequiredSprintFiles,
  REQUIRED_ARTIFACT_FILES
} from "./lib/member-utils.mjs";
import { runAndPrint } from "./lib/run-command.mjs";

const branch = getBranch();
const args = process.argv.slice(2);
const context = loadGuardrailContext({ branch, args });
const validationIndex = args.indexOf("--validation");
const validation = validationIndex >= 0 ? args[validationIndex + 1] : "Pending";
const targetPaths = [
  ...REQUIRED_ARTIFACT_FILES.map((fileName) => `${artifactDir(context.member.key)}/${fileName}`),
  ...getRequiredSprintFiles(context.sprint.sprintDir)
];

try {
  withFileTransaction(targetPaths, () => {
    runRequired("node", [
      "scripts/artifact-update.mjs",
      "--member",
      context.member.key,
      "--validation",
      validation
    ]);
    runRequired("node", [
      "scripts/sprint-update.mjs",
      "--member",
      context.member.key,
      "--validation",
      validation
    ]);
    runRequired("npm", ["exec", "--", "prettier", "--write", ...targetPaths]);
  });
} catch (error) {
  console.error(`FAIL: Status update rolled back. ${error.message}`);
  process.exit(1);
}

console.log(
  `PASS: Updated ${context.member.key} artifacts and ${context.sprint.sprintSlug} status atomically.`
);

function runRequired(command, commandArgs) {
  const result = runAndPrint(command, commandArgs, { cwd: path.resolve(".") });
  if (!result.ok) {
    throw new Error(`${result.command} failed with exit code ${result.status}.`);
  }
}
