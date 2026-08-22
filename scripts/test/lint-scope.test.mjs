import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

function readRootLintTokens() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
  return packageJson.scripts.lint.trim().split(/\s+/);
}

test("root lint targets source areas instead of the entire working tree", () => {
  const tokens = readRootLintTokens();

  assert.equal(tokens[0], "eslint");
  assert.ok(!tokens.includes("."), "root lint must not scan the entire working tree");

  for (const target of [
    "backend",
    "frontend",
    "electron",
    "scripts",
    "tools",
    "database",
    "eslint.config.mjs"
  ]) {
    assert.ok(tokens.includes(target), `root lint must include ${target}`);
  }
});
