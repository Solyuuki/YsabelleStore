import fs from "node:fs";

import { writeFileAtomic } from "./atomic-write.mjs";
import { artifactDir } from "./member-utils.mjs";
import {
  cleanupAutomatedSections,
  ensureSectionWithTable,
  today,
  upsertTableRow
} from "./markdown-utils.mjs";

export function validationSummaryPath(memberKey) {
  return `${artifactDir(memberKey)}/VALIDATION-SUMMARY.md`;
}

export function aggregateValidationRows(status) {
  const passed = status === "Passed";
  const failed = status === "Failed";

  return [
    {
      command: "npm run verify:code",
      notes: passed
        ? "The aggregate read-only code verification completed successfully."
        : failed
          ? "The aggregate read-only code verification failed; review its command output."
          : "Run the aggregate read-only code verification and record its result.",
      result: passed ? "Passed" : failed ? "Failed" : "Pending"
    }
  ];
}

export function artifactEvidenceIssues(content, { branch, date }) {
  const issues = [];
  const lines = content.split(/\r?\n/);

  if (lines.some((line) => /^##[^\r\n]*\|/.test(line))) {
    issues.push("Malformed heading contains Markdown table cells.");
  }

  if (lines.filter((line) => line.trim() === "## Validation Results").length > 1) {
    issues.push("Validation Results heading is duplicated.");
  }

  let aggregatePassed = false;
  for (const line of lines) {
    if (!line.trim().startsWith("|")) continue;
    const cells = parseEvidenceRow(line);
    if (cells[0] !== date) continue;

    const commandIndex = branch ? (cells[1] === branch ? 2 : -1) : 1;
    if (commandIndex < 0) continue;
    const command = cells[commandIndex]?.replaceAll("`", "").trim();
    const result = cells[commandIndex + 1]?.trim();

    if (command === "npm run verify:code" && result === "Passed") {
      aggregatePassed = true;
    } else if (result === "Passed") {
      issues.push(`Unverified command is recorded as Passed: ${command || "(missing)"}.`);
    }
  }

  if (!aggregatePassed) {
    issues.push("Current aggregate npm run verify:code Passed evidence is missing.");
  }

  return issues;
}

export function writeValidationSummary(member, branch, rows) {
  const filePath = validationSummaryPath(member.key);

  if (!fs.existsSync(filePath)) {
    writeFileAtomic(filePath, "# Validation Summary\n\n");
  }

  cleanupAutomatedSections(filePath);
  ensureSectionWithTable(filePath, "Validation Results", [
    "Date",
    "Branch",
    "Command",
    "Result",
    "Notes"
  ]);

  for (const row of rows) {
    upsertTableRow(filePath, "Validation Results", ["Date", "Branch", "Command"], {
      Date: today(),
      Branch: branch,
      Command: row.command,
      Result: row.result,
      Notes: row.notes ?? ""
    });
  }
}

export function readValidationStatus(memberKey) {
  const filePath = validationSummaryPath(memberKey);

  if (!fs.existsSync(filePath)) {
    return "Pending";
  }

  const content = fs.readFileSync(filePath, "utf8");

  if (content.includes("| Failed |")) {
    return "Failed";
  }

  if (content.includes("| Passed |")) {
    return "Passed";
  }

  return "Pending";
}

function parseEvidenceRow(line) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}
