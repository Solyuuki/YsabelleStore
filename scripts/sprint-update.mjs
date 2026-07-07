import { classifyChanges } from "./lib/change-classifier.mjs";
import { collectChangedFiles, getBranch } from "./lib/git-utils.mjs";
import { REQUIRED_SPRINT_FILES, requireMember } from "./lib/member-utils.mjs";
import {
  ensureMarkdownFile,
  markdownList,
  table,
  today,
  updateAutoSection
} from "./lib/markdown-utils.mjs";
import { readValidationStatus } from "./lib/validation-summary.mjs";

const branch = getBranch();
const member = requireMember(branch);
const changes = collectChangedFiles();
const classified = classifyChanges(changes);
const validationStatus = getValidationStatus();
const date = today();

for (const filePath of REQUIRED_SPRINT_FILES) {
  ensureMarkdownFile(filePath, sprintHeading(filePath));
}

updateMemberFile();
updateBacklog();
updateDefinitionOfDone();
updateReadme();

console.log(`Updated Sprint 2 docs for ${member.key}.`);

function getValidationStatus() {
  const flag = process.argv.find((arg) => arg.startsWith("--validation="));
  if (flag) {
    return flag.split("=")[1] || "Pending";
  }

  const index = process.argv.indexOf("--validation");
  if (index >= 0) {
    return process.argv[index + 1] || "Pending";
  }

  return readValidationStatus(member.key);
}

function updateMemberFile() {
  updateAutoSection(
    `docs/sprints/sprint-2/members/${member.key}.md`,
    table(
      ["Date", "Branch", "Work Areas", "Completed / Updated Work", "Evidence", "Next QA"],
      [
        [
          date,
          branch,
          markdownList(classified.areas),
          markdownList(classified.summaries),
          markdownList(classified.importantFiles),
          nextQa()
        ]
      ]
    ),
    "Automated Sprint Member Update"
  );
}

function updateBacklog() {
  updateAutoSection(
    "docs/sprints/sprint-2/SPRINT-BACKLOG.md",
    table(
      ["Date", "Member", "Detected Item", "Status", "Evidence"],
      classified.summaries.map((summary) => [
        date,
        member.displayName,
        summary,
        validationStatus,
        markdownList(classified.importantFiles)
      ])
    ),
    "Automated Sprint Backlog Activity"
  );
}

function updateDefinitionOfDone() {
  updateAutoSection(
    "docs/sprints/sprint-2/DEFINITION-OF-DONE.md",
    table(
      ["Date", "Member", "Validation Checklist", "Status", "Notes"],
      [
        [
          date,
          member.displayName,
          "prepush:local / push-ready",
          validationStatus,
          validationStatus === "Passed"
            ? "Validation passed locally."
            : "Validation must pass before push."
        ]
      ]
    ),
    "Automated Validation Status"
  );
}

function updateReadme() {
  updateAutoSection(
    "docs/sprints/sprint-2/README.md",
    table(
      ["Date", "Member", "Branch", "Latest Activity", "Validation Status"],
      [[date, member.displayName, branch, markdownList(classified.summaries), validationStatus]]
    ),
    "Automated Latest Sprint Activity"
  );
}

function nextQa() {
  if (classified.manualQa) {
    return "Manual QA required for auth/device/UI flow.";
  }

  if (classified.risky) {
    return "Review backend/database validation evidence.";
  }

  return "Review generated sprint docs.";
}

function sprintHeading(filePath) {
  return filePath.split("/").at(-1).replace(".md", "").replaceAll("-", " ");
}
