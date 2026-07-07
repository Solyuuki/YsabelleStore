import fs from "node:fs";

import { classifyChanges } from "./lib/change-classifier.mjs";
import { collectChangedFiles, getBranch } from "./lib/git-utils.mjs";
import { REQUIRED_SPRINT_FILES, requireMember } from "./lib/member-utils.mjs";
import { AUTO_END, AUTO_START, readAutoSection } from "./lib/markdown-utils.mjs";
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
addCheck("Current member auto section", hasAutoSection(memberFile), memberFile);
addCheck(
  "DEFINITION-OF-DONE auto validation section",
  hasAutoSection("docs/sprints/sprint-2/DEFINITION-OF-DONE.md"),
  "Validation auto section present."
);
addCheck(
  "SPRINT-BACKLOG auto activity section",
  hasAutoSection("docs/sprints/sprint-2/SPRINT-BACKLOG.md"),
  "Backlog auto section present."
);

if (hasImplementationChanges()) {
  addCheck(
    "Implementation changes documented in member sprint file",
    includesBranch(memberFile),
    branch
  );
}

addCheck(
  "Current member auto section has no TODO/TBD/FIXME/placeholder",
  !hasUnfinishedMarkers(readAutoSection(memberFile)),
  "Pending validation status is allowed before push-ready."
);
addCheck(
  "Definition of Done auto section has no TODO/TBD/FIXME/placeholder",
  !hasUnfinishedMarkers(readAutoSection("docs/sprints/sprint-2/DEFINITION-OF-DONE.md")),
  "Pending validation status is allowed before push-ready."
);

printTable(["Requirement", "Status", "Notes"], rows);

if (rows.some((row) => row[1] === "FAIL")) {
  process.exit(1);
}

function addCheck(name, ok, notes) {
  rows.push([name, ok ? "PASS" : "FAIL", notes]);
}

function hasAutoSection(filePath) {
  return (
    fs.existsSync(filePath) &&
    fs.readFileSync(filePath, "utf8").includes(AUTO_START) &&
    fs.readFileSync(filePath, "utf8").includes(AUTO_END)
  );
}

function includesBranch(filePath) {
  return fs.existsSync(filePath) && fs.readFileSync(filePath, "utf8").includes(branch);
}

function hasUnfinishedMarkers(content) {
  return /\b(TODO|TBD|FIXME|placeholder)\b/i.test(content);
}

function hasImplementationChanges() {
  return classified.files.some(
    (file) =>
      /^(frontend|backend|electron|database|forecasting-service|scripts)\//.test(file) ||
      /^(package\.json|package-lock\.json|tsconfig)/.test(file)
  );
}
