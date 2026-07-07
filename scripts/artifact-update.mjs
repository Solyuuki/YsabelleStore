import fs from "node:fs";

import { classifyChanges, statusFor } from "./lib/change-classifier.mjs";
import { collectChangedFiles, getBranch } from "./lib/git-utils.mjs";
import { artifactDir, REQUIRED_ARTIFACT_FILES, requireMember } from "./lib/member-utils.mjs";
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
  updateAutoSection(
    `${memberDir}/README.md`,
    table(
      ["Item", "Value"],
      [
        ["Last automated update", date],
        ["Current branch", rows.branch],
        ["Current work areas", rows.changedAreas],
        ["Latest detected tasks", rows.detectedWork],
        ["Validation status", rows.validationStatus]
      ]
    )
  );
}

function updateTasks() {
  updateAutoSection(
    `${memberDir}/TASKS.md`,
    table(
      ["Date", "Branch", "Area", "Detected Work", "Status", "Evidence"],
      [
        [
          date,
          branch,
          markdownList(classified.areas),
          markdownList(classified.summaries),
          workStatus,
          markdownList(classified.importantFiles)
        ]
      ]
    )
  );
}

function updateSprintProgress() {
  updateAutoSection(
    `${memberDir}/SPRINT-PROGRESS.md`,
    table(
      ["Date", "Branch", "Member", "Progress Summary", "Changed Areas", "Validation Status"],
      [
        [
          date,
          branch,
          member.displayName,
          markdownList(classified.summaries),
          markdownList(classified.areas),
          validationStatus
        ]
      ]
    )
  );
}

function updateDailyNotes() {
  updateAutoSection(
    `${memberDir}/DAILY-NOTES.md`,
    [
      `### ${date} Automated Update`,
      "",
      `- Branch: ${branch}`,
      `- Member: ${member.displayName}`,
      `- Changed areas: ${markdownList(classified.areas)}`,
      `- Key files: ${markdownList(classified.importantFiles)}`,
      `- Detected completed work: ${markdownList(classified.summaries)}`,
      `- Validation status: ${validationStatus}`,
      `- Follow-up needed: ${followUpNeeded()}`
    ].join("\n")
  );
}

function updateDecisions() {
  const rows = classified.decisions.length
    ? classified.decisions.map((decision) => [
        date,
        decision.decision,
        decision.reason,
        markdownList(classified.importantFiles)
      ])
    : [
        [
          date,
          "No new architectural or security decision detected.",
          "Changed files did not match a major decision rule.",
          markdownList(classified.importantFiles)
        ]
      ];

  updateAutoSection(
    `${memberDir}/DECISIONS.md`,
    table(["Date", "Decision", "Reason", "Affected Files"], rows)
  );
}

function updateBlockers() {
  const blockers = [];

  if (validationStatus === "Failed") {
    blockers.push("Push-ready validation failed; fix the failing command before pushing.");
  }

  if (validationStatus !== "Passed") {
    blockers.push("Push-ready validation has not passed yet.");
  }

  if (classified.manualQa) {
    blockers.push("Manual QA is required for auth, device, route, or UI behavior.");
  }

  if (
    classified.files.some((file) =>
      /database\/(prisma\/migrations|migrations)|schema\.prisma/.test(file)
    )
  ) {
    blockers.push(
      "Prisma migration must be applied locally before running the updated database flow."
    );
  }

  if (classified.files.some((file) => /Toast|toast/.test(file))) {
    blockers.push("Toast behavior requires UI verification.");
  }

  updateAutoSection(
    `${memberDir}/BLOCKERS.md`,
    table(
      ["Date", "Potential Blocker", "Evidence", "Status"],
      (blockers.length ? blockers : ["No blocker detected from changed files."]).map((blocker) => [
        date,
        blocker,
        markdownList(classified.importantFiles),
        validationStatus === "Passed"
          ? "Validation passed; review manually if behavior changed"
          : "Open"
      ])
    )
  );
}

function updateTestingReports() {
  const commands = [
    "npm run format",
    "npm run format:check",
    "npm run lint",
    "npm run typecheck --workspace frontend",
    "npm run typecheck --workspace backend",
    "npm run typecheck --workspace electron",
    "npm run build",
    "npm audit --audit-level=high"
  ];

  updateAutoSection(
    `${memberDir}/TESTING-REPORTS.md`,
    table(
      ["Date", "Command", "Result", "Notes"],
      commands.map((command) => [
        date,
        command,
        validationStatus === "Passed"
          ? "Passed"
          : validationStatus === "Failed"
            ? "Failed or blocked"
            : "Pending",
        validationStatus === "Passed"
          ? "Recorded by push-ready validation."
          : "Run npm run prepush:local before push."
      ])
    )
  );
}

function updateDeploymentNotes() {
  const note = classified.deploymentRelevant
    ? "Deployment/runtime attention required for database, backend, package, Electron, or migration changes."
    : "No deployment-specific change detected.";

  updateAutoSection(
    `${memberDir}/DEPLOYMENT-NOTES.md`,
    table(
      ["Date", "Area", "Note", "Evidence"],
      [[date, markdownList(classified.areas), note, markdownList(classified.importantFiles)]]
    )
  );
}

function updateSprintPlanning() {
  updateAutoSection(
    `${memberDir}/SPRINT-PLANNING.md`,
    table(
      ["Date", "Next Recommended Task", "QA Focus", "Affected Module", "Priority"],
      [
        [
          date,
          nextTask(),
          qaFocus(),
          markdownList(classified.areas),
          classified.risky || classified.manualQa ? "High" : "Normal"
        ]
      ]
    )
  );
}

function followUpNeeded() {
  if (validationStatus !== "Passed") {
    return "Run npm run prepush:local and review generated markdown changes.";
  }

  if (classified.manualQa) {
    return "Complete manual QA for the affected UI/auth/device flow.";
  }

  return "Review generated artifacts before staging.";
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
