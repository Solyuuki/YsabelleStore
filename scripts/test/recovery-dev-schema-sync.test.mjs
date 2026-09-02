import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

test("fresh development startup synchronizes the Prisma schema and generated client before the backend starts", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
  const devScript = fs.readFileSync(path.join(REPO_ROOT, "scripts", "dev.mjs"), "utf8");

  assert.equal(
    packageJson.scripts["prisma:sync:dev"],
    "prisma db push --schema database/prisma/schema.prisma --skip-generate && npm run prisma:generate"
  );
  assert.doesNotMatch(packageJson.scripts["prisma:sync:dev"], /accept-data-loss/);

  const schemaSyncIndex = devScript.indexOf("synchronizeDevelopmentDatabaseSchema();");
  const backendStartIndex = devScript.indexOf('console.info("Starting YsabelleStore backend...");');

  assert.notEqual(
    schemaSyncIndex,
    -1,
    "development startup must invoke the database schema/client sync"
  );
  assert.notEqual(backendStartIndex, -1, "development startup must still start the backend");
  assert.ok(
    schemaSyncIndex < backendStartIndex,
    "the Prisma schema and generated client must be synchronized before the backend can accept requests"
  );
  assert.match(devScript, /"run", "prisma:sync:dev"/);
});
