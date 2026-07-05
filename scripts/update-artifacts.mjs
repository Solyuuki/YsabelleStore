import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const PASS_ICON = "\u2705";
const FAIL_ICON = "\u274c";
const WARN_ICON = "\u26a0\ufe0f";

const members = {
  m1: {
    key: "m1",
    label: "M1 / Abarado",
    artifactFolder: "docs/implementation-artifacts/m1-abarado",
    sprintMemberFile: "docs/sprints/sprint-2/members/m1-abarado.md"
  },
  m2: {
    key: "m2",
    label: "M2 / Ramos",
    artifactFolder: "docs/implementation-artifacts/m2-ramos",
    sprintMemberFile: "docs/sprints/sprint-2/members/m2-ramos.md"
  },
  m3: {
    key: "m3",
    label: "M3 / Vito",
    artifactFolder: "docs/implementation-artifacts/m3-vito",
    sprintMemberFile: "docs/sprints/sprint-2/members/m3-vito.md"
  }
};

const optionalArtifactFiles = [
  "TASKS.md",
  "SPRINT-PROGRESS.md",
  "TESTING-REPORTS.md",
  "DAILY-NOTES.md",
  "BLOCKERS.md",
  "DECISIONS.md",
  "DEPLOYMENT-NOTES.md",
  "README.md"
];

const sprintFiles = [
  "docs/sprints/sprint-2/SPRINT-BACKLOG.md",
  "docs/sprints/sprint-2/MEMBER-ASSIGNMENTS.md",
  "docs/sprints/sprint-2/README.md"
];

function runGit(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function runGitSafe(args) {
  try {
    return runGit(args);
  } catch {
    return "";
  }
}

function parseArgs(argv) {
  const args = {};

  for (const item of argv) {
    if (!item.startsWith("--")) {
      continue;
    }

    const equalsIndex = item.indexOf("=");
    if (equalsIndex === -1) {
      args[item.slice(2)] = "true";
      continue;
    }

    args[item.slice(2, equalsIndex)] = item.slice(equalsIndex + 1);
  }

  return args;
}

function lines(output) {
  if (!output) {
    return [];
  }

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/\\/g, "/"));
}

function expandPath(filePath) {
  if (!existsSync(filePath)) {
    return [filePath];
  }

  const stats = statSync(filePath);
  if (!stats.isDirectory()) {
    return [filePath.replace(/\\/g, "/")];
  }

  return readdirSync(filePath, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(filePath, entry.name).replace(/\\/g, "/");
    return entry.isDirectory() ? expandPath(child) : [child];
  });
}

function untrackedFromStatus(output) {
  if (!output) {
    return [];
  }

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("?? "))
    .flatMap((line) => expandPath(line.slice(3).trim().replace(/\\/g, "/")));
}

function formatTimestamp() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).map((part) => [part.type, part.value])
  );

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} Asia/Manila`;
}

function inferMember({ explicitMember, branch, changedFiles }) {
  if (explicitMember) {
    const normalized = explicitMember.toLowerCase();
    if (members[normalized]) {
      return members[normalized];
    }

    fail(`Unknown member "${explicitMember}". Use --member=m1, --member=m2, or --member=m3.`);
  }

  for (const [key, member] of Object.entries(members)) {
    if (branch.startsWith(`${key}/`)) {
      return member;
    }
  }

  for (const [key, member] of Object.entries(members)) {
    if (changedFiles.some((file) => file.startsWith(`${member.artifactFolder}/`))) {
      return members[key];
    }
  }

  if (branch.startsWith("sprint/")) {
    fail(`Unable to infer member on sprint branch.

Run one of the following:
npm run artifacts:update -- --member=m1
npm run artifacts:update -- --member=m2
npm run artifacts:update -- --member=m3`);
  }

  fail("Unable to infer member. Run with --member=m1, --member=m2, or --member=m3.");
}

function classifyFile(file) {
  if (file.startsWith("frontend/src/")) return "Frontend";
  if (file.startsWith("backend/src/")) return "Backend";
  if (file.startsWith("electron/src/")) return "Electron";
  if (file.startsWith("database/prisma/")) return "Database / Prisma";
  if (file.startsWith("database/migrations/")) return "Database Migration";
  if (file.startsWith("forecasting-service/")) return "Forecasting";
  if (file.startsWith("scripts/")) return "Tooling / Scripts";
  if (file === "docker-compose.yml" || file === ".dockerignore") return "Docker / DevOps";
  if (file === ".env.example") return "Environment Setup";
  if (file === "package.json") return "Project Scripts / Dependencies";
  if (file === "package-lock.json") return "Dependencies";
  if (file.startsWith("docs/sprints/")) return "Sprint Documentation";
  if (file.startsWith("docs/implementation-artifacts/")) return "Implementation Artifacts";
  if (file.startsWith("docs/")) return "Documentation";
  if (file.startsWith(".github/workflows/")) return "CI/CD";
  if (file.startsWith(".husky/")) return "Git Hooks";
  return "Unclassified";
}

function taskLabelForFiles(files) {
  const lowerFiles = files.map((file) => file.toLowerCase());
  const has = (predicate) => lowerFiles.some(predicate);
  const hasAuthWord = (file) => /login|auth|access|user|register|session/.test(file);

  if (has((file) => file.startsWith("frontend/") && hasAuthWord(file))) {
    return "Auth/Login UI Update";
  }
  if (
    has(
      (file) =>
        file.startsWith("backend/") && /auth|user|session|security|middleware|token/.test(file)
    )
  ) {
    return "Auth Backend Update";
  }
  if (
    has(
      (file) => file === "docker-compose.yml" || file === ".dockerignore" || file === ".env.example"
    )
  ) {
    return "Docker Development Setup";
  }
  if (has((file) => file === "scripts/update-artifacts.mjs")) {
    return "Automatic Artifact Log Generator";
  }
  if (has((file) => file === "scripts/check-artifacts.mjs")) {
    return "Artifact Tracking Guardrail";
  }
  if (has((file) => file === "scripts/sprint-ready.mjs")) {
    return "Sprint Ready Workflow";
  }
  if (has((file) => file === "scripts/healthcheck.mjs" || file === "package.json")) {
    return "Project Healthcheck Script";
  }
  if (has((file) => file.startsWith("database/prisma/"))) {
    return "Database Schema Update";
  }
  if (has((file) => file.startsWith("database/migrations/"))) {
    return "Database Migration Update";
  }
  if (has((file) => file.startsWith("forecasting-service/"))) {
    return "Forecasting Service Update";
  }
  if (has((file) => file.startsWith("docs/sprints/"))) {
    return "Sprint Documentation Update";
  }
  if (has((file) => file.startsWith("docs/implementation-artifacts/"))) {
    return "Implementation Artifact Update";
  }
  if (has((file) => file.startsWith(".github/workflows/"))) {
    return "CI/CD Workflow Update";
  }
  if (has((file) => file.startsWith(".husky/"))) {
    return "Git Hook Update";
  }

  return "Unclassified Repository Update";
}

function isDocumentationOnly(files) {
  return files.every(
    (file) => file.startsWith("docs/") || file.endsWith(".md") || file === "AGENTS.md"
  );
}

function statusForFiles(files, validationReport) {
  if (files.some((file) => classifyFile(file) === "Unclassified")) {
    return "Needs review";
  }

  if (isDocumentationOnly(files)) {
    return "Documented";
  }

  if (!validationReport) {
    return "Implemented / Needs review";
  }

  return "Implemented / Needs review";
}

function evidenceList(files, limit = 5) {
  const escaped = files.slice(0, limit).map((file) => `\`${file}\``);
  if (files.length > limit) {
    escaped.push(`and ${files.length - limit} more`);
  }
  return escaped.join(", ") || "Needs review";
}

function groupByCategory(files) {
  const groups = new Map();

  for (const file of files) {
    const category = classifyFile(file);
    if (!groups.has(category)) {
      groups.set(category, []);
    }
    groups.get(category).push(file);
  }

  return [...groups.entries()].map(([category, groupFiles]) => ({
    category,
    files: groupFiles,
    label: taskLabelForFiles(groupFiles)
  }));
}

function parseValidationReport(reportPath) {
  if (!reportPath) {
    return null;
  }

  const normalized = reportPath.replace(/\\/g, "/");
  if (normalized === ".env" || normalized.startsWith(".env/")) {
    fail("Refusing to read .env as a validation report.");
  }

  if (!existsSync(reportPath)) {
    fail(`Validation report not found: ${normalized}`);
  }

  const content = readFileSync(reportPath, "utf8");
  const rows = [];
  const pattern = /^([^:]+):\s*(PASS|FAIL|BLOCKED)\s*$/i;

  for (const line of content.split(/\r?\n/)) {
    const match = line.match(pattern);
    if (!match) {
      continue;
    }

    const result = match[2].toUpperCase();
    rows.push({
      check: match[1].trim(),
      result: result === "PASS" ? "Passed" : result === "FAIL" ? "Failed" : "Blocked"
    });
  }

  return {
    path: normalized,
    content,
    rows
  };
}

function blockerFix(blocker) {
  const lower = blocker.toLowerCase();

  if (lower.includes("eperm") || lower.includes("prisma")) {
    return "Stop running Node/backend processes and rerun validation";
  }
  if (lower.includes("eaddrinuse") || lower.includes("port already in use")) {
    return "Stop the process using the port and rerun validation";
  }
  if (lower.includes("docker")) {
    return "Start Docker Desktop or verify the Docker daemon before rerunning validation";
  }
  if (lower.includes("migration")) {
    return "Review migration output and rerun database validation";
  }
  if (lower.includes("typecheck")) {
    return "Fix TypeScript errors and rerun validation";
  }
  if (lower.includes("build")) {
    return "Review build output and rerun validation";
  }
  if (lower.includes("cannot find module")) {
    return "Install dependencies and rerun validation";
  }

  return "Needs review";
}

function validationBlocker(validationReport) {
  if (!validationReport) {
    return null;
  }

  const patterns = [
    "EPERM",
    "EADDRINUSE",
    "Prisma",
    "failed",
    "cannot find module",
    "port already in use",
    "Docker not installed",
    "Docker daemon",
    "migration failed",
    "typecheck failed",
    "build failed"
  ];
  const match = patterns.find((pattern) =>
    validationReport.content.toLowerCase().includes(pattern.toLowerCase())
  );

  return match ? `${match} detected in validation report` : null;
}

function signatureFor({ member, source, files, labels, timestamp }) {
  const date = timestamp.slice(0, 10);
  return ["artifact-signature", member.key, source, date, files.join("|"), labels.join("|")].join(
    ":"
  );
}

function appendSection(file, section, signature, updates) {
  if (!existsSync(file)) {
    updates.push({ file, status: `${WARN_ICON} Missing` });
    console.warn(`Warning: optional artifact file missing: ${file}`);
    return;
  }

  const content = readFileSync(file, "utf8");
  if (content.includes(`<!-- ${signature} -->`)) {
    updates.push({ file, status: `${WARN_ICON} Duplicate skipped` });
    return;
  }

  writeFileSync(file, `${content.trimEnd()}\n\n<!-- ${signature} -->\n${section}\n`);
  updates.push({ file, status: `${PASS_ICON} Updated` });
}

function replaceLatestSection(file, section, updates) {
  if (!existsSync(file)) {
    updates.push({ file, status: `${WARN_ICON} Missing` });
    console.warn(`Warning: optional artifact file missing: ${file}`);
    return;
  }

  const heading = "## Latest Sprint 2 Auto-Tracked Update";
  const content = readFileSync(file, "utf8");
  const start = content.indexOf(heading);

  if (start === -1) {
    writeFileSync(file, `${content.trimEnd()}\n\n${section}\n`);
    updates.push({ file, status: `${PASS_ICON} Updated` });
    return;
  }

  const next = content.indexOf("\n## ", start + heading.length);
  const before = content.slice(0, start).trimEnd();
  const after = next === -1 ? "" : content.slice(next).trimStart();
  writeFileSync(file, `${before}\n\n${section}\n\n${after}`.trimEnd() + "\n");
  updates.push({ file, status: `${PASS_ICON} Updated` });
}

function buildTasksSection({ timestamp, groups, validationReport }) {
  const rows = groups
    .map(
      (group) =>
        `| ${group.label} | ${statusForFiles(group.files, validationReport)} | ${evidenceList(group.files)} | ${
          validationReport
            ? `Validation evidence: \`${validationReport.path}\``
            : "Pending validation"
        } |`
    )
    .join("\n");

  return `## Sprint 2 Auto-Tracked Task Log — ${timestamp}

| Task Area | Status | Evidence | Notes |
| --- | ---: | --- | --- |
${rows}`;
}

function buildProgressSection({ timestamp, groups }) {
  const rows = groups
    .map(
      (group) =>
        `| ${group.category} | ${group.files.length} | ${group.label} | ${evidenceList(group.files)} |`
    )
    .join("\n");

  return `## Progress Entry — ${timestamp}

| Category | Files Changed | Summary | Evidence |
| --- | ---: | --- | --- |
${rows}`;
}

function buildTestingSection({ timestamp, validationReport }) {
  if (!validationReport) {
    return `## Validation Entry — ${timestamp}

| Check | Result | Notes |
| --- | ---: | --- |
| Validation status | Pending | Run \`npm run healthcheck\` and attach command output before marking checks as passed |`;
  }

  const rows =
    validationReport.rows.length > 0
      ? validationReport.rows
          .map((row) => `| ${row.check} | ${row.result} | Evidence from validation report |`)
          .join("\n")
      : "| Validation report parsing | Needs review | Validation report was provided but no PASS/FAIL/BLOCKED lines were parsed |";

  return `## Validation Entry — ${timestamp}

| Check | Result | Notes |
| --- | ---: | --- |
${rows}`;
}

function buildDailySection({ timestamp, member, source }) {
  return `## Daily Note — ${timestamp}

| Member | Source | Summary |
| --- | --- | --- |
| ${member.label} | ${source} | Auto-tracked Sprint 2 work based on Git file changes |`;
}

function buildBlockerSection({ timestamp, blocker, evidence }) {
  return `## Blocker Entry — ${timestamp}

| Blocker | Status | Evidence | Recommended Fix |
| --- | ---: | --- | --- |
| ${blocker} | Active / Needs verification | ${evidence} | ${blockerFix(blocker)} |`;
}

function buildDecisionSection({ timestamp, decision }) {
  return `## Decision Entry — ${timestamp}

| Decision | Rationale | Impact |
| --- | --- | --- |
| ${decision} | Needs review | Needs review |`;
}

function hasDeploymentChange(files) {
  return files.some(
    (file) =>
      file === "docker-compose.yml" ||
      file === ".dockerignore" ||
      file === ".env.example" ||
      file.startsWith("deployment/") ||
      file.toLowerCase().includes("docker")
  );
}

function buildDeploymentSection(timestamp) {
  return `## Deployment Note — ${timestamp}

| Area | Update | Notes |
| --- | --- | --- |
| Docker / DevOps | Docker-related files changed | Review Docker Desktop and \`docker compose up -d\` setup instructions |`;
}

function buildReadmeLatestSection({ timestamp, source }) {
  return `## Latest Sprint 2 Auto-Tracked Update

| Timestamp | Source | Summary |
| --- | --- | --- |
| ${timestamp} | ${source} | Artifact update generated from Git file changes |`;
}

function buildSprintMemberSection({ timestamp, groups, validationReport }) {
  const rows = groups
    .map(
      (group) =>
        `| ${group.label} | ${statusForFiles(group.files, validationReport)} | ${evidenceList(group.files)} | ${
          validationReport
            ? `Validation evidence: \`${validationReport.path}\``
            : "Pending validation"
        } |`
    )
    .join("\n");

  return `## Auto-Tracked Sprint 2 Update — ${timestamp}

| Work Area | Status | Evidence | Notes |
| --- | ---: | --- | --- |
${rows}`;
}

function buildBacklogSection({ timestamp, member, groups, validationReport }) {
  const rows = groups
    .map(
      (group) =>
        `| ${member.label} | ${group.label} | ${statusForFiles(group.files, validationReport)} | ${evidenceList(group.files)} |`
    )
    .join("\n");

  return `## Auto-Tracked Backlog Update — ${timestamp}

| Member | Task Area | Status | Evidence |
| --- | --- | ---: | --- |
${rows}`;
}

function buildAssignmentSection({ timestamp, member, groups }) {
  const rows = groups
    .map((group) => `| ${member.label} | ${group.category} | ${evidenceList(group.files)} |`)
    .join("\n");

  return `## Auto-Tracked Assignment Update — ${timestamp}

| Member | Ownership Area | Evidence |
| --- | --- | --- |
${rows}`;
}

function printReport({ branch, member, source, files, timestamp, groups, updates }) {
  console.log("\nARTIFACT UPDATE REPORT\n");
  console.log("| Field | Value |");
  console.log("| --- | --- |");
  console.log(`| Branch | ${branch || "unknown"} |`);
  console.log(`| Member | ${member.label} |`);
  console.log(`| Source | ${source} |`);
  console.log(`| Files detected | ${files.length} |`);
  console.log(`| Timestamp | ${timestamp} |`);
  console.log("");
  console.log("| Category | Files Changed | Summary |");
  console.log("| --- | ---: | --- |");
  for (const group of groups) {
    console.log(`| ${group.category} | ${group.files.length} | ${group.label} |`);
  }
  console.log("");
  console.log("| File Updated | Status |");
  console.log("| --- | ---: |");
  for (const update of updates) {
    console.log(`| ${update.file} | ${update.status} |`);
  }
  console.log("\nFinal Verdict:");
  console.log(`${PASS_ICON} Artifact update completed.`);
}

function fail(message) {
  console.error("\nARTIFACT UPDATE REPORT\n");
  console.error(message);
  console.error("\nFinal Verdict:");
  console.error(`${FAIL_ICON} Artifact update failed.`);
  process.exit(1);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const branch = runGitSafe(["branch", "--show-current"]);
  const statusShort = runGitSafe(["status", "--short"]);
  const stagedFiles = lines(runGitSafe(["diff", "--cached", "--name-only"]));
  const cachedStat = runGitSafe(["diff", "--cached", "--stat"]);
  const unstagedFiles = [
    ...lines(runGitSafe(["diff", "--name-only"])),
    ...untrackedFromStatus(statusShort)
  ];
  const latestCommit = runGitSafe(["log", "-1", "--pretty=format:%h"]);
  const source = stagedFiles.length > 0 ? "staged changes" : "unstaged changes";
  const files = stagedFiles.length > 0 ? stagedFiles : unstagedFiles;

  void statusShort;
  void cachedStat;
  void latestCommit;

  if (files.length === 0) {
    console.log("No staged or unstaged file changes found. No artifact update generated.");
    console.log("\nFinal Verdict:");
    console.log(`${PASS_ICON} No artifact update needed.`);
    process.exit(0);
  }

  const member = inferMember({
    explicitMember: args.member,
    branch,
    changedFiles: [...stagedFiles, ...unstagedFiles]
  });

  if (!existsSync(member.artifactFolder)) {
    fail(`Main artifact folder is missing: ${member.artifactFolder}`);
  }

  const timestamp = formatTimestamp();
  const validationReport = parseValidationReport(args["validation-report"]);
  const groups = groupByCategory(files);
  const labels = groups.map((group) => group.label);
  const signature = signatureFor({ member, source, files, labels, timestamp });
  const updates = [];

  const artifactPath = (file) => path.join(member.artifactFolder, file).replace(/\\/g, "/");

  appendSection(
    artifactPath("TASKS.md"),
    buildTasksSection({ timestamp, groups, validationReport }),
    signature,
    updates
  );
  appendSection(
    artifactPath("SPRINT-PROGRESS.md"),
    buildProgressSection({ timestamp, groups }),
    signature,
    updates
  );
  appendSection(
    artifactPath("TESTING-REPORTS.md"),
    buildTestingSection({ timestamp, validationReport }),
    signature,
    updates
  );
  appendSection(
    artifactPath("DAILY-NOTES.md"),
    buildDailySection({ timestamp, member, source }),
    signature,
    updates
  );

  const reportBlocker = validationBlocker(validationReport);
  if (args.blocker || reportBlocker) {
    appendSection(
      artifactPath("BLOCKERS.md"),
      buildBlockerSection({
        timestamp,
        blocker: args.blocker || reportBlocker,
        evidence: args.blocker ? "User-provided blocker" : "Validation report"
      }),
      signature,
      updates
    );
  }

  if (args.decision) {
    appendSection(
      artifactPath("DECISIONS.md"),
      buildDecisionSection({ timestamp, decision: args.decision }),
      signature,
      updates
    );
  }

  if (hasDeploymentChange(files)) {
    appendSection(
      artifactPath("DEPLOYMENT-NOTES.md"),
      buildDeploymentSection(timestamp),
      signature,
      updates
    );
  }

  replaceLatestSection(
    artifactPath("README.md"),
    buildReadmeLatestSection({ timestamp, source }),
    updates
  );

  appendSection(
    member.sprintMemberFile,
    buildSprintMemberSection({ timestamp, groups, validationReport }),
    signature,
    updates
  );
  appendSection(
    "docs/sprints/sprint-2/SPRINT-BACKLOG.md",
    buildBacklogSection({ timestamp, member, groups, validationReport }),
    signature,
    updates
  );
  appendSection(
    "docs/sprints/sprint-2/MEMBER-ASSIGNMENTS.md",
    buildAssignmentSection({ timestamp, member, groups }),
    signature,
    updates
  );
  appendSection(
    "docs/sprints/sprint-2/README.md",
    buildBacklogSection({ timestamp, member, groups, validationReport }),
    signature,
    updates
  );

  for (const file of optionalArtifactFiles) {
    const fullPath = artifactPath(file);
    if (!existsSync(fullPath)) {
      console.warn(`Warning: optional artifact file missing: ${fullPath}`);
    }
  }

  for (const file of sprintFiles) {
    if (!existsSync(file)) {
      console.warn(`Warning: optional sprint file missing: ${file}`);
    }
  }

  printReport({ branch, member, source, files, timestamp, groups, updates });
}

main();
