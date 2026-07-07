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

export function getBranch() {
  return runCommand("git", ["branch", "--show-current"]).stdout.trim() || "unknown";
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
  const upstream = getUpstream();
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

  if (upstream) {
    const result = runCommand("git", ["diff", "--name-status", `${upstream}...HEAD`]);
    if (result.ok) {
      results.push(...parseNameStatus(result.stdout));
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
