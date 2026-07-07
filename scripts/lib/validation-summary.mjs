import fs from "node:fs";

import { artifactDir } from "./member-utils.mjs";
import { today, updateAutoSection, table } from "./markdown-utils.mjs";

export function validationSummaryPath(memberKey) {
  return `${artifactDir(memberKey)}/VALIDATION-SUMMARY.md`;
}

export function writeValidationSummary(member, branch, rows) {
  const filePath = validationSummaryPath(member.key);
  const content = table(
    ["Date", "Branch", "Command", "Result", "Notes"],
    rows.map((row) => [today(), branch, row.command, row.result, row.notes ?? ""])
  );

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, "# Validation Summary\n\n", "utf8");
  }

  updateAutoSection(filePath, content, "Automated Validation Summary");
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
