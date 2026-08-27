import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

test("fresh development startup synchronizes the Prisma schema and client before the backend starts", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
  const devScript = fs.readFileSync(path.join(REPO_ROOT, "scripts", "dev.mjs"), "utf8");

  assert.equal(
    packageJson.scripts["prisma:sync:dev"],
    "prisma db push --schema database/prisma/schema.prisma --skip-generate"
  );
  assert.doesNotMatch(packageJson.scripts["prisma:sync:dev"], /accept-data-loss/);

  const schemaSyncIndex = devScript.indexOf("synchronizeDevelopmentDatabaseSchema();");
  const clientGenerateIndex = devScript.indexOf("generateDevelopmentPrismaClient();");
  const backendStartIndex = devScript.indexOf('console.info("Starting YsabelleStore backend...");');

  assert.notEqual(schemaSyncIndex, -1, "development startup must invoke the database schema sync");
  assert.notEqual(clientGenerateIndex, -1, "development startup must regenerate the Prisma client");
  assert.notEqual(backendStartIndex, -1, "development startup must still start the backend");
  assert.ok(
    schemaSyncIndex < clientGenerateIndex,
    "the database schema must be synchronized before regenerating the Prisma client"
  );
  assert.ok(
    clientGenerateIndex < backendStartIndex,
    "the Prisma client must be regenerated before the backend can accept requests"
  );
  assert.match(devScript, /"run", "prisma:sync:dev"/);
  assert.match(devScript, /"run", "prisma:generate"/);
});
