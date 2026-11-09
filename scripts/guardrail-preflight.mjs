import fs from "node:fs";

import { getBranch } from "./lib/git-utils.mjs";
import { loadGuardrailContext } from "./lib/guardrail-config.mjs";
import { getRequiredSprintFiles } from "./lib/member-utils.mjs";

const branch = getBranch();
const context = loadGuardrailContext({
  branch,
  args: process.argv.slice(2),
  memberRequired: false
});
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
console.log(`member: ${context.member?.key ?? "sprint-integration"}`);
console.log(`activeSprint: ${context.sprint.sprintNumber}`);
console.log(`sprintDir: ${context.sprint.sprintDir}`);
console.log("PASS: Guardrail preconditions are satisfied.");

if (process.env.GITHUB_ACTIONS === "true") {
  const prettier = await import("prettier");
  const paths = [
    "backend/src/modules/catalog/uatRetailCategoryClassifier.ts",
    "backend/src/scripts/applyUatRetailCategories.ts",
    "backend/test/uat-retail-category-classifier.test.ts",
    "scripts/test/uat-d02-d03-improvements.test.mjs"
  ];
  for (const path of paths) {
    const formatted = await prettier.format(fs.readFileSync(path, "utf8"), {
      ...(await prettier.resolveConfig(path)),
      filepath: path
    });
    console.log("UAT_FORMAT_JSON:" + JSON.stringify({ path, content: formatted }));
  }
}
