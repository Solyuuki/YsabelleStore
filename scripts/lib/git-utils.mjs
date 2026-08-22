import { runCommand } from "./run-command.mjs";

function normalizePath(path) {
  return path.replaceAll("\\", "/").trim();
}

function parseNameStatus(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /^[ACDMRTUX?]/.test(line))
    .map((line) => {
      const parts = line.split(/\t+/);
      const status = parts[0];
      const file = normalizePath(parts.at(-1) ?? "");

      return file ? { file, status } : null;
    })
    .filter(Boolean);
}

function parseShortStatus(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => {
      const status = line.slice(0, 2).trim() || "M";
      const file = normalizePath(line.slice(3));

      return file ? { file, status } : null;
    })
    .filter(Boolean);
}

function environmentValue(name) {
  const value = process.env[name]?.trim();
  return value || null;
}

function resolveGitRef(refName) {
  if (!refName || refName === "unknown") {
    return null;
  }

  for (const candidate of [refName, `origin/${refName}`]) {
    const result = runCommand("git", ["rev-parse", "--verify", "--quiet", candidate]);
    if (result.ok) {
      return candidate;
    }
  }

  return null;
}

export function getBranch() {
  const explicitBranch = environmentValue("YSABELLE_BRANCH");
  if (explicitBranch) {
    return explicitBranch;
  }

  const pullRequestBranch = environmentValue("GITHUB_HEAD_REF");
  if (pullRequestBranch) {
    return pullRequestBranch;
  }

  const localBranch = runCommand("git", ["branch", "--show-current"]).stdout.trim();
  if (localBranch) {
    return localBranch;
  }

  return environmentValue("GITHUB_REF_NAME") ?? "unknown";
}

export function getBaseRef() {
  return environmentValue("YSABELLE_BASE_REF") ?? environmentValue("GITHUB_BASE_REF");
}

export function getUpstream() {
  const result = runCommand("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);

  return result.ok ? result.stdout.trim() : null;
}

export function getStatusShort() {
  return runCommand("git", ["status", "--short", "--untracked-files=all"]).stdout.trim();
}

export function getRecentLog() {
  return runCommand("git", ["log", "--oneline", "-5"]).stdout.trim();
}

export function collectChangedFiles() {
  const results = [];

  for (const args of [
    ["diff", "--name-status"],
    ["diff", "--cached", "--name-status"],
    ["status", "--short", "--untracked-files=all"]
  ]) {
    const result = runCommand("git", args);
    if (result.ok) {
      results.push(
        ...(args[0] === "status" ? parseShortStatus(result.stdout) : parseNameStatus(result.stdout))
      );
    }
  }

  const baseRef = getBaseRef();
  if (baseRef) {
    const resolvedBase = resolveGitRef(baseRef);
    const resolvedHead = resolveGitRef(getBranch());
    if (resolvedBase && resolvedHead) {
      const result = runCommand("git", [
        "diff",
        "--name-status",
        `${resolvedBase}...${resolvedHead}`
      ]);
      if (result.ok) {
        results.push(...parseNameStatus(result.stdout));
      }
    }
  } else {
    const upstream = getUpstream();
    if (upstream) {
      const result = runCommand("git", ["diff", "--name-status", `${upstream}...HEAD`]);
      if (result.ok) {
        results.push(...parseNameStatus(result.stdout));
      }
    }
  }

  if (results.length === 0) {
    const result = runCommand("git", ["show", "--name-status", "--format=", "HEAD"]);
    if (result.ok) {
      results.push(...parseNameStatus(result.stdout));
    }
  }

  const byFile = new Map();
  for (const item of results) {
    byFile.set(item.file, item);
  }

  return [...byFile.values()].sort((left, right) => left.file.localeCompare(right.file));
}
