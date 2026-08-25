import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

function readText(relativePath) {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
}

test("Prettier accepts platform-native checkout line endings", () => {
  const config = JSON.parse(readText(".prettierrc.json"));
  assert.equal(config.endOfLine, "auto");
});

test("Prettier ignores generated package output and installed agent metadata", () => {
  const ignored = new Set(
    readText(".prettierignore")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  );

  for (const required of ["electron/release*/", ".agents/", ".codex/"]) {
    assert.ok(ignored.has(required), `.prettierignore must include ${required}`);
  }
});
