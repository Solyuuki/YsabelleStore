import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

test("dependency installation generates the repository Prisma client", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));

  assert.equal(packageJson.scripts.postinstall, "npm run prisma:generate");
  assert.equal(
    packageJson.scripts["prisma:generate"],
    "prisma generate --schema database/prisma/schema.prisma"
  );
});

test("read-only code verification regenerates Prisma before TypeScript checking", () => {
  const verificationScript = fs.readFileSync(
    path.join(REPO_ROOT, "scripts", "verify-code.mjs"),
    "utf8"
  );

  const generationIndex = verificationScript.indexOf('args: ["run", "prisma:generate"]');
  const typecheckIndex = verificationScript.indexOf('args: ["run", "typecheck"]');

  assert.ok(generationIndex >= 0, "verify:code must generate the Prisma client");
  assert.ok(typecheckIndex >= 0, "verify:code must run TypeScript checking");
  assert.ok(
    generationIndex < typecheckIndex,
    "Prisma client generation must run before TypeScript checking"
  );
});
