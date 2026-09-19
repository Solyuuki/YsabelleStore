import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { inspectMigrationSources } from "../prisma-migration-readiness.mjs";

const models = `model User {\n id String @id\n @@map("users")\n}\nmodel CustomerSavedAddress {\n customerAccountId String @id\n @@map("customer_saved_addresses")\n}\n`;

test("detects duplicate CREATE TABLE, missing model, and untracked model", () => {
  const migrations = new Map([
    ["0001", "CREATE TABLE `users` (id varchar(191));"],
    [
      "0002",
      "/* CREATE TABLE hidden (id int); */ -- CREATE TABLE ignored (id int)\nCREATE TABLE users (id varchar(191)); CREATE TABLE customer_order_address_snapshots (id varchar(191));"
    ]
  ]);
  const findings = inspectMigrationSources(models, migrations);
  assert.equal(findings.filter((x) => x.includes("created twice")).length, 1);
  assert.ok(findings.some((x) => x.includes("no historical migration creates")));
  assert.ok(findings.some((x) => x.includes("absent from schema.prisma")));
  assert.equal(findings.length, 3);
});

test("clean static sources pass without implying a successful database migration", () => {
  assert.deepEqual(
    inspectMigrationSources(
      'model User {\n id String @id\n @@map("users")\n}',
      new Map([["0001", "CREATE TABLE `users` (id varchar(191));"]])
    ),
    []
  );
});

test("CLI fails closed on missing repository without writing files", () => {
  const root = mkdtempSync(join(tmpdir(), "prisma-readiness-"));
  try {
    const marker = join(root, "keep.txt");
    writeFileSync(marker, "untouched");
    const result = spawnSync(
      process.execPath,
      [
        join(dirname(fileURLToPath(import.meta.url)), "..", "prisma-migration-readiness.mjs"),
        "--root",
        root
      ],
      { encoding: "utf8" }
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /MIGRATION_READINESS=BLOCKED/);
    assert.equal(readFileSync(marker, "utf8"), "untouched");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
