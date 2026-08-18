import fs from "node:fs";

import { getBranch } from "./lib/git-utils.mjs";
import { loadGuardrailContext } from "./lib/guardrail-config.mjs";
import { getRequiredSprintFiles } from "./lib/member-utils.mjs";

const branch = getBranch();
const context = loadGuardrailContext({ branch, args: process.argv.slice(2) });
const missingFiles = getRequiredSprintFiles(context.sprint.sprintDir).filter(
  (filePath) => !fs.existsSync(filePath) || fs.statSync(filePath).size === 0
);

if (missingFiles.length > 0) {
  throw new Error(
    `Active ${context.sprint.sprintSlug} documentation is incomplete. Missing or empty: ${missingFiles.join(
      ", "
    )}. Add the established sprint templates before running status updates.`
  );
}

console.log(`branch: ${branch}`);
console.log(`member: ${context.member.key}`);
console.log(`activeSprint: ${context.sprint.sprintNumber}`);
console.log(`sprintDir: ${context.sprint.sprintDir}`);
console.log("PASS: Guardrail mutation preconditions are satisfied.");
