import fs from "node:fs";

import { classifyChanges } from "./lib/change-classifier.mjs";
import { collectChangedFiles, getBranch } from "./lib/git-utils.mjs";
import {
  artifactDir,
  MEMBERS,
  REQUIRED_ARTIFACT_FILES,
  requireMember
} from "./lib/member-utils.mjs";
import { fileContains, today } from "./lib/markdown-utils.mjs";
import { printTable } from "./lib/run-command.mjs";

const branch = getBranch();
const member = requireMember(branch);
const changes = collectChangedFiles();
const classified = classifyChanges(changes);
const rows = [];

for (const memberInfo of Object.values(MEMBERS)) {
  const dir = artifactDir(memberInfo.key);
  addCheck(`Artifact folder ${memberInfo.key}`, fs.existsSync(dir), dir);

  for (const fileName of REQUIRED_ARTIFACT_FILES) {
    const filePath = `${dir}/${fileName}`;
    addCheck(
      `${memberInfo.key}/${fileName}`,
      fs.existsSync(filePath) && fs.statSync(filePath).size > 0,
      "Required artifact file exists and is not empty."
    );
  }
}

for (const fileName of REQUIRED_ARTIFACT_FILES) {
  const filePath = `${artifactDir(member.key)}/${fileName}`;
  addCheck(
    `Current member template preserved ${fileName}`,
    !hasAutomatedProgressSection(filePath),
    "No duplicated automated progress section."
  );
}

if (hasImplementationChanges()) {
  addCheck(
    "Implementation changes documented in TASKS.md",
    containsBranch(`${artifactDir(member.key)}/TASKS.md`),
    branch
  );
  addCheck(
    "Implementation changes documented in SPRINT-PROGRESS.md",
    containsBranch(`${artifactDir(member.key)}/SPRINT-PROGRESS.md`),
    branch
  );
}

if (classified.risky) {
  addCheck(
    "Risky changes documented in BLOCKERS.md",
    fileContains(`${artifactDir(member.key)}/BLOCKERS.md`, "Active Blockers"),
    "Blocker template present."
  );
  addCheck(
    "Validation evidence documented in TESTING-REPORTS.md",
    fileContains(`${artifactDir(member.key)}/TESTING-REPORTS.md`, dateOrBranchEvidence()),
    "Testing report contains current evidence."
  );
}

printTable(["Requirement", "Status", "Notes"], rows);

if (rows.some((row) => row[1] === "FAIL")) {
  process.exit(1);
}

function addCheck(name, ok, notes) {
  rows.push([name, ok ? "PASS" : "FAIL", notes]);
}

function hasAutomatedProgressSection(filePath) {
  return (
    fs.existsSync(filePath) &&
    /## Automated (?:Progress Update|Validation Summary|Sprint Member Update|Sprint Backlog Activity|Validation Status|Latest Sprint Activity)/.test(
      fs.readFileSync(filePath, "utf8")
    )
  );
}

function containsBranch(filePath) {
  return fs.existsSync(filePath) && fs.readFileSync(filePath, "utf8").includes(branch);
}

function dateOrBranchEvidence() {
  return today();
}

function hasImplementationChanges() {
  return classified.files.some(
    (file) =>
      /^(frontend|backend|electron|database|forecasting-service|scripts)\//.test(file) ||
      /^(package\.json|package-lock\.json|tsconfig)/.test(file)
  );
}
