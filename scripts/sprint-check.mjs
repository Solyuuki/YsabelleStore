import fs from "node:fs";

import { classifyChanges } from "./lib/change-classifier.mjs";
import { collectChangedFiles, getBranch } from "./lib/git-utils.mjs";
import { REQUIRED_SPRINT_FILES, requireMember } from "./lib/member-utils.mjs";
import { printTable } from "./lib/run-command.mjs";

const branch = getBranch();
const member = requireMember(branch);
const classified = classifyChanges(collectChangedFiles());
const rows = [];
const memberFile = `docs/sprints/sprint-2/members/${member.key}.md`;

for (const filePath of REQUIRED_SPRINT_FILES) {
  addCheck(
    filePath,
    fs.existsSync(filePath) && fs.statSync(filePath).size > 0,
    "Required Sprint 2 doc exists and is not empty."
  );
}

addCheck("Current member sprint file", fs.existsSync(memberFile), memberFile);
addCheck("Current member sprint activity", includesBranch(memberFile), memberFile);
addCheck(
  "DEFINITION-OF-DONE validation section",
  includesText("docs/sprints/sprint-2/DEFINITION-OF-DONE.md", "Validation Status"),
  "Validation template section present."
);
addCheck(
  "SPRINT-BACKLOG activity section",
  includesText("docs/sprints/sprint-2/SPRINT-BACKLOG.md", "Sprint Activity Log"),
  "Backlog activity template section present."
);

if (hasImplementationChanges()) {
  addCheck(
    "Implementation changes documented in member sprint file",
    includesBranch(memberFile),
    branch
  );
}

addCheck(
  "Current member sprint activity has no automated progress section",
  !hasAutomatedProgressSection(memberFile),
  "Template table is used instead of marker blocks."
);
addCheck(
  "Definition of Done has no automated progress section",
  !hasAutomatedProgressSection("docs/sprints/sprint-2/DEFINITION-OF-DONE.md"),
  "Template table is used instead of marker blocks."
);

printTable(["Requirement", "Status", "Notes"], rows);

if (rows.some((row) => row[1] === "FAIL")) {
  process.exit(1);
}

function addCheck(name, ok, notes) {
  rows.push([name, ok ? "PASS" : "FAIL", notes]);
}

function includesBranch(filePath) {
  return fs.existsSync(filePath) && fs.readFileSync(filePath, "utf8").includes(branch);
}

function includesText(filePath, text) {
  return fs.existsSync(filePath) && fs.readFileSync(filePath, "utf8").includes(text);
}

function hasAutomatedProgressSection(filePath) {
  return (
    fs.existsSync(filePath) &&
    /## Automated (?:Progress Update|Validation Summary|Sprint Member Update|Sprint Backlog Activity|Validation Status|Latest Sprint Activity)/.test(
      fs.readFileSync(filePath, "utf8")
    )
  );
}

function hasImplementationChanges() {
  return classified.files.some(
    (file) =>
      /^(frontend|backend|electron|database|forecasting-service|scripts)\//.test(file) ||
      /^(package\.json|package-lock\.json|tsconfig)/.test(file)
  );
}
