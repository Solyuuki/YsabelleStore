import { classifyChanges } from "./lib/change-classifier.mjs";
import { collectChangedFiles, getBranch } from "./lib/git-utils.mjs";
import { getRequiredSprintFiles, requireMember, requireSprint } from "./lib/member-utils.mjs";
import {
  cleanupAutomatedSections,
  ensureMarkdownFile,
  ensureSectionWithTable,
  markdownList,
  removeTableRows,
  today,
  upsertTableRow
} from "./lib/markdown-utils.mjs";
import { readValidationStatus } from "./lib/validation-summary.mjs";

const branch = getBranch();
const member = requireMember(branch);
const sprint = requireSprint(branch);
const changes = collectChangedFiles();
const classified = classifyChanges(changes);
const validationStatus = getValidationStatus();
const date = today();

console.log(`branch: ${branch}`);
console.log(`member: ${member.key}`);
console.log(`sprintVersion: ${sprint.sprintVersion}`);
console.log(`sprintDir: ${sprint.sprintDir}`);

for (const filePath of getRequiredSprintFiles(sprint.sprintDir)) {
  ensureMarkdownFile(filePath, sprintHeading(filePath));
}

updateMemberFile();
updateBacklog();
updateDefinitionOfDone();
updateReadme();

console.log(`Updated ${sprint.sprintSlug} docs for ${member.key}.`);

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
  const filePath = `${sprint.sprintDir}/members/${member.key}.md`;
  cleanupAutomatedSections(filePath);
  ensureSectionWithTable(filePath, "Current Sprint Activity", [
    "Date",
    "Branch",
    "Work Areas",
    "Completed / Updated Work",
    "Evidence",
    "Next QA"
  ]);
  upsertTableRow(filePath, "Current Sprint Activity", ["Date", "Branch"], {
    Date: date,
    Branch: branch,
    "Work Areas": markdownList(classified.areas),
    "Completed / Updated Work": sprintWorkSummary(),
    Evidence: markdownList(reportFiles()),
    "Next QA": nextQa()
  });
}

function updateBacklog() {
  const filePath = `${sprint.sprintDir}/SPRINT-BACKLOG.md`;
  cleanupAutomatedSections(filePath);
  ensureSectionWithTable(filePath, "Sprint Activity Log", [
    "Date",
    "Member",
    "Work Item",
    "Status",
    "Evidence"
  ]);
  upsertTableRow(filePath, "Sprint Activity Log", ["Date", "Member", "Work Item"], {
    Date: date,
    Member: member.displayName,
    "Work Item": sprintWorkSummary(),
    Status: validationStatus,
    Evidence: markdownList(reportFiles())
  });
}

function updateDefinitionOfDone() {
  const filePath = `${sprint.sprintDir}/DEFINITION-OF-DONE.md`;
  cleanupAutomatedSections(filePath);
  ensureSectionWithTable(filePath, "Validation Status", [
    "Date",
    "Member",
    "Validation Checklist",
    "Status",
    "Notes"
  ]);
  removeTableRows(
    filePath,
    "Validation Status",
    (row) => row.Date === date && row.Member === member.displayName
  );
  upsertTableRow(filePath, "Validation Status", ["Date", "Member", "Validation Checklist"], {
    Date: date,
    Member: member.displayName,
    "Validation Checklist": "npm run verify:code",
    Status: validationStatus,
    Notes:
      validationStatus === "Passed"
        ? "Aggregate read-only code verification passed locally."
        : "Aggregate read-only code verification must pass before push."
  });
}

function updateReadme() {
  const filePath = `${sprint.sprintDir}/README.md`;
  cleanupAutomatedSections(filePath);
  ensureSectionWithTable(filePath, "Latest Sprint Activity", [
    "Date",
    "Member",
    "Branch",
    "Latest Activity",
    "Validation Status"
  ]);
  upsertTableRow(filePath, "Latest Sprint Activity", ["Date", "Member", "Branch"], {
    Date: date,
    Member: member.displayName,
    Branch: branch,
    "Latest Activity": sprintWorkSummary(),
    "Validation Status": validationStatus
  });
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

function sprintWorkSummary() {
  if (classified.files.some((file) => file.startsWith("scripts/"))) {
    return "Artifact automation was updated to preserve existing markdown templates and avoid duplicated generated sections.";
  }

  if (classified.manualQa) {
    return "Auth UI and session UX were updated while preserving trusted-device and route-guard behavior.";
  }

  return "Sprint documentation and validation evidence were updated for the current branch.";
}

function reportFiles() {
  const preferred = classified.importantFiles.filter(
    (file) =>
      !/docs\/implementation-artifacts\/.*\/(README|TASKS|DAILY-NOTES|DECISIONS|BLOCKERS|TESTING-REPORTS|DEPLOYMENT-NOTES|SPRINT-PLANNING|SPRINT-PROGRESS|VALIDATION-SUMMARY)\.md/.test(
        file
      )
  );

  return (preferred.length ? preferred : classified.importantFiles).slice(0, 8);
}

function sprintHeading(filePath) {
  return filePath.split("/").at(-1).replace(".md", "").replaceAll("-", " ");
}
