import fs from "node:fs";

import { classifyChanges, statusFor } from "./lib/change-classifier.mjs";
import { collectChangedFiles, getBranch } from "./lib/git-utils.mjs";
import { artifactDir, REQUIRED_ARTIFACT_FILES, requireMember } from "./lib/member-utils.mjs";
import {
  cleanupAutomatedSections,
  ensureMarkdownFile,
  ensureSectionWithTable,
  markdownList,
  removeTableRows,
  today,
  upsertTableRow
} from "./lib/markdown-utils.mjs";
import { aggregateValidationRows, readValidationStatus } from "./lib/validation-summary.mjs";

const branch = getBranch();
const member = requireMember(branch);
const changes = collectChangedFiles();
const classified = classifyChanges(changes);
const validationStatus = getValidationStatus();
const workStatus = statusFor(validationStatus, classified);
const date = today();
const memberDir = artifactDir(member.key);

fs.mkdirSync(memberDir, { recursive: true });

for (const fileName of REQUIRED_ARTIFACT_FILES) {
  ensureMarkdownFile(
    `${memberDir}/${fileName}`,
    `${member.displayName} ${fileName.replace(".md", "")}`
  );
}

updateReadme();
updateTasks();
updateDailyNotes();
updateDecisions();
updateBlockers();
updateTestingReports();
updateValidationSummary();
updateDeploymentNotes();
updateSprintPlanning();
updateSprintProgress();

console.log(`Updated implementation artifacts for ${member.key}.`);

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

function baseRows() {
  return {
    branch,
    changedAreas: markdownList(classified.areas),
    detectedWork: markdownList(classified.summaries),
    evidence: markdownList(classified.importantFiles),
    member: member.displayName,
    validationStatus
  };
}

function updateReadme() {
  const rows = baseRows();
  const filePath = `${memberDir}/README.md`;
  cleanupAutomatedSections(filePath);
  ensureSectionWithTable(filePath, "Current Work Snapshot", ["Item", "Value"]);

  for (const [item, value] of [
    ["Last update", date],
    ["Current branch", rows.branch],
    ["Current work areas", rows.changedAreas],
    ["Current work summary", currentWorkSummary()],
    ["Validation status", rows.validationStatus]
  ]) {
    upsertTableRow(filePath, "Current Work Snapshot", ["Item"], { Item: item, Value: value });
  }
}

function updateTasks() {
  const filePath = `${memberDir}/TASKS.md`;
  cleanupAutomatedSections(filePath);
  upsertTableRow(filePath, "In Progress", ["Task ID"], {
    "Task ID": currentTaskId(),
    Scope: currentTaskScope(),
    Status: workStatus,
    Evidence: branch,
    "Next Action": nextTask()
  });
}

function updateSprintProgress() {
  const filePath = `${memberDir}/SPRINT-PROGRESS.md`;
  cleanupAutomatedSections(filePath);
  upsertTableRow(filePath, "Chronological Progress", ["Date", "Progress"], {
    Date: date,
    Progress: currentWorkSummary(),
    Evidence: `${branch}; ${markdownList(reportFiles())}; validation: ${validationStatus}`
  });
}

function updateDailyNotes() {
  const filePath = `${memberDir}/DAILY-NOTES.md`;
  cleanupAutomatedSections(filePath);
  upsertTableRow(filePath, "Chronological Daily Log", ["Date", "Focus"], {
    Date: date,
    Focus: currentFocus(),
    "Completed Work": currentWorkSummary(),
    "Files/Modules": markdownList(reportFiles()),
    Validation: validationSummary(),
    Issues: issueSummary(),
    "Next Action": nextTask()
  });
}

function updateDecisions() {
  const filePath = `${memberDir}/DECISIONS.md`;
  cleanupAutomatedSections(filePath);

  for (const [index, decision] of classified.decisions.entries()) {
    upsertTableRow(filePath, "Engineering Decisions", ["Decision ID"], {
      "Decision ID": `DEC-${member.key.toUpperCase()}-${date.replaceAll("-", "")}-${index + 1}`,
      Date: date,
      Area: markdownList(classified.areas),
      Decision: decision.decision,
      Reason: decision.reason,
      Evidence: markdownList(reportFiles())
    });
  }
}

function updateBlockers() {
  const filePath = `${memberDir}/BLOCKERS.md`;
  cleanupAutomatedSections(filePath);
  upsertTableRow(filePath, "Active Blockers", ["Blocker ID"], {
    "Blocker ID": "None",
    Owner: "None",
    "Current Status":
      validationStatus === "Failed"
        ? "Validation failed; review command output."
        : "No active blockers. Manual QA remains recommended before merge.",
    "Required Action":
      validationStatus === "Failed"
        ? "Fix the failing validation command before review."
        : "Complete manual QA for changed user-facing flows."
  });
}

function updateTestingReports() {
  const filePath = `${memberDir}/TESTING-REPORTS.md`;
  cleanupAutomatedSections(filePath);
  removeTableRows(filePath, "Historical Validation Detail", (row) => row.Date === date);

  for (const evidence of aggregateValidationRows(validationStatus)) {
    upsertTableRow(filePath, "Historical Validation Detail", ["Date", "Command"], {
      Date: date,
      Command: `\`${evidence.command}\``,
      Result: evidence.result,
      Notes: evidence.notes
    });
  }

  upsertTableRow(filePath, "Manual Review Evidence", ["Date", "Area"], {
    Date: date,
    Area: manualQaArea(),
    Result: classified.manualQa ? "Not yet manually verified" : "Not required by changed files",
    Notes: classified.manualQa
      ? "Manual QA remains recommended for trusted-device Continue, logout confirmation, dynamic health states, wrong-login validation animation, and session restore toast."
      : "No changed user-facing flow was detected by the artifact update."
  });
}

function updateValidationSummary() {
  const filePath = `${memberDir}/VALIDATION-SUMMARY.md`;

  cleanupAutomatedSections(filePath);
  ensureSectionWithTable(filePath, "Validation Results", [
    "Date",
    "Branch",
    "Command",
    "Result",
    "Notes"
  ]);
  removeTableRows(
    filePath,
    "Validation Results",
    (row) => row.Date === date && row.Branch === branch
  );

  for (const evidence of aggregateValidationRows(validationStatus)) {
    upsertTableRow(filePath, "Validation Results", ["Date", "Branch", "Command"], {
      Date: date,
      Branch: branch,
      Command: evidence.command,
      Result: evidence.result,
      Notes: evidence.notes
    });
  }
}

function updateDeploymentNotes() {
  const note = classified.deploymentRelevant
    ? "Deployment/runtime attention required for database, backend, package, Electron, or migration changes."
    : "No deployment-specific change detected.";

  const filePath = `${memberDir}/DEPLOYMENT-NOTES.md`;
  cleanupAutomatedSections(filePath);
  upsertTableRow(filePath, "Deployment Readiness Log", ["Date", "Area"], {
    Date: date,
    Area: markdownList(classified.areas),
    Note: note,
    Evidence: markdownList(reportFiles())
  });
}

function updateSprintPlanning() {
  const filePath = `${memberDir}/SPRINT-PLANNING.md`;
  cleanupAutomatedSections(filePath);
  ensureSectionWithTable(filePath, "Planning Updates", [
    "Date",
    "Next Recommended Task",
    "QA Focus",
    "Affected Module",
    "Priority"
  ]);
  upsertTableRow(filePath, "Planning Updates", ["Date", "Affected Module"], {
    Date: date,
    "Next Recommended Task": nextTask(),
    "QA Focus": qaFocus(),
    "Affected Module": markdownList(classified.areas),
    Priority: classified.risky || classified.manualQa ? "High" : "Normal"
  });
}

function currentTaskId() {
  return `YSB-${member.key.toUpperCase()}-${date.replaceAll("-", "")}`;
}

function currentTaskScope() {
  if (classified.files.some((file) => file.startsWith("scripts/"))) {
    return "Preserve artifact markdown templates during automation updates";
  }

  if (classified.manualQa) {
    return "Polish auth UI and session safety flow";
  }

  return "Maintain current implementation and documentation evidence";
}

function currentFocus() {
  if (classified.files.some((file) => file.startsWith("scripts/"))) {
    return "Artifact automation template preservation";
  }

  if (classified.manualQa) {
    return "Auth welcome UI and logout session safety";
  }

  return "Implementation documentation and validation";
}

function currentWorkSummary() {
  if (classified.files.some((file) => file.startsWith("scripts/"))) {
    return "Updated artifact and sprint automation so it preserves existing markdown templates, updates table rows idempotently, and removes duplicated automated sections.";
  }

  if (classified.manualQa) {
    return "Polished the Welcome/Login and session experience, preserved trusted-device behavior, and kept validation evidence synchronized with implementation artifacts.";
  }

  return "Updated the implementation evidence and validation notes for the current branch.";
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

function validationSummary() {
  if (validationStatus === "Passed") {
    return "The aggregate read-only code verification passed.";
  }

  if (validationStatus === "Failed") {
    return "Validation failed. Review the failing command output before merge.";
  }

  return "Validation is pending. Run the aggregate read-only code verification before push.";
}

function issueSummary() {
  if (validationStatus === "Failed") {
    return "Validation failure requires follow-up.";
  }

  if (classified.manualQa) {
    return "Manual QA still recommended for changed user-facing flows.";
  }

  return "No active blockers.";
}

function manualQaArea() {
  return classified.manualQa
    ? "Auth UI, trusted-device flow, logout confirmation, and session restore"
    : "Changed files";
}

function nextTask() {
  if (validationStatus !== "Passed") {
    return "Run push-ready validation and resolve any failures.";
  }

  if (classified.manualQa) {
    return "Perform manual QA on the changed auth/device/UI flow.";
  }

  return "Review generated artifact updates before commit.";
}

function qaFocus() {
  if (classified.manualQa) {
    return "Auth/device continuation, logout, route access, and toast behavior.";
  }

  if (classified.risky) {
    return "Backend/database validation and migration application.";
  }

  return "Documentation and validation review.";
}
