import fs from "node:fs";

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

export function writeValidationSummary(member, branch, rows) {
  const filePath = validationSummaryPath(member.key);

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "# Validation Summary\n\n", "utf8");
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
