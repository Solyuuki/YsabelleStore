import { execFileSync } from "node:child_process";
import process from "node:process";

const PASS_ICON = "\u2705";
const FAIL_ICON = "\u274c";

const memberArtifacts = {
  m1: "docs/implementation-artifacts/m1-abarado/",
  m2: "docs/implementation-artifacts/m2-ramos/",
  m3: "docs/implementation-artifacts/m3-vito/"
};

function runGit(args) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "";
  }
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

function isImplementationFile(file) {
  return (
    file.startsWith("frontend/src/") ||
    file.startsWith("backend/src/") ||
    file.startsWith("electron/src/") ||
    file.startsWith("database/prisma/") ||
    file.startsWith("database/migrations/") ||
    file.startsWith("forecasting-service/") ||
    file.startsWith("scripts/") ||
    file.startsWith(".github/workflows/") ||
    file.startsWith(".husky/") ||
    file === "docker-compose.yml" ||
    file === ".dockerignore" ||
    file === "package.json" ||
    file === "package-lock.json" ||
    file === ".env.example"
  );
}

function sprintDocFiles(files) {
  return files.filter((file) => file.startsWith("docs/sprints/sprint-2/"));
}

function artifactFiles(files) {
  return files.filter((file) =>
    Object.values(memberArtifacts).some((prefix) => file.startsWith(prefix))
  );
}

function memberFromBranch(branch) {
  if (branch.startsWith("m1/")) return "m1";
  if (branch.startsWith("m2/")) return "m2";
  if (branch.startsWith("m3/")) return "m3";
  return null;
}

function evidence(files, fallback) {
  if (files.length === 0) {
    return fallback;
  }

  const shown = files.slice(0, 5).map((file) => `\`${file}\``);
  if (files.length > 5) {
    shown.push(`and ${files.length - 5} more`);
  }
  return shown.join(", ");
}

function row(label, ok, notes) {
  console.log(`| ${label} | ${ok ? `${PASS_ICON} YES` : `${FAIL_ICON} NO`} | ${notes} |`);
}

function main() {
  const branch = runGit(["branch", "--show-current"]);
  const stagedFiles = lines(runGit(["diff", "--cached", "--name-only"]));
  const implementationFiles = stagedFiles.filter(isImplementationFile);
  const sprintDocs = sprintDocFiles(stagedFiles);
  const artifacts = artifactFiles(stagedFiles);
  const branchMember = memberFromBranch(branch);
  const requiredMemberArtifacts = branchMember
    ? artifacts.filter((file) => file.startsWith(memberArtifacts[branchMember]))
    : artifacts;

  const implementationChanged = implementationFiles.length > 0;
  const sprintDocsUpdated = sprintDocs.length > 0;
  const artifactsUpdated = artifacts.length > 0;
  const memberArtifactsUpdated = branch.startsWith("sprint/")
    ? artifactsUpdated
    : branchMember
      ? requiredMemberArtifacts.length > 0
      : artifactsUpdated;
  const passes =
    !implementationChanged ||
    (implementationChanged && (sprintDocsUpdated || artifactsUpdated) && memberArtifactsUpdated);

  console.log("\nARTIFACT TRACKING CHECK\n");
  console.log("| Check | Status | Notes |");
  console.log("| --- | ---: | --- |");
  row(
    "Implementation files changed",
    implementationChanged,
    evidence(implementationFiles, "No staged implementation changes")
  );
  row(
    "Sprint docs updated",
    sprintDocsUpdated,
    evidence(sprintDocs, "Missing Sprint 2 documentation update")
  );
  row(
    "Member artifacts updated",
    memberArtifactsUpdated,
    memberArtifactsUpdated
      ? evidence(requiredMemberArtifacts, "Member artifact update detected")
      : "Missing member artifact update"
  );

  console.log("\nFinal Verdict:");
  if (passes) {
    console.log(`${PASS_ICON} Artifact tracking requirement satisfied.`);
    process.exit(0);
  }

  console.log(`${FAIL_ICON} Artifact tracking requirement failed.`);
  console.log("\nRequired action:");
  console.log("Update the correct files before committing:");
  console.log("- docs/sprints/sprint-2/members/<member>.md");
  console.log("- docs/sprints/sprint-2/SPRINT-BACKLOG.md");
  console.log("- docs/implementation-artifacts/<member>/TASKS.md");
  console.log("- docs/implementation-artifacts/<member>/SPRINT-PROGRESS.md");
  console.log("- docs/implementation-artifacts/<member>/TESTING-REPORTS.md");
  console.log("- docs/implementation-artifacts/<member>/BLOCKERS.md if there is a blocker");
  console.log("- docs/implementation-artifacts/<member>/DECISIONS.md if there is a decision");
  process.exit(1);
}

main();
