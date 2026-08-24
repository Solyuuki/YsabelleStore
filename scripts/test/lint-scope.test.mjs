import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

function readPackage(relativePath = "package.json") {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8"));
}

test("root lint targets authored source paths instead of whole workspaces", () => {
  const lint = readPackage().scripts.lint;

  assert.equal(
    lint,
    "eslint backend/src backend/test frontend/src frontend/vite.config.ts frontend/tailwind.config.ts frontend/postcss.config.js electron/src electron/electron-builder.config.cjs scripts tools/repo-context database/seed eslint.config.mjs"
  );

  const tokens = lint.trim().split(/\s+/);
  for (const broadTarget of [".", "backend", "frontend", "electron", "tools", "database"]) {
    assert.ok(!tokens.includes(broadTarget), `root lint must not scan broad target ${broadTarget}`);
  }
});

test("workspace lint scripts cannot scan generated files outside authored source paths", () => {
  assert.equal(readPackage("backend/package.json").scripts.lint, "eslint src test");
  assert.equal(
    readPackage("frontend/package.json").scripts.lint,
    "eslint src vite.config.ts tailwind.config.ts postcss.config.js"
  );
  assert.equal(
    readPackage("electron/package.json").scripts.lint,
    "eslint src electron-builder.config.cjs"
  );
});
