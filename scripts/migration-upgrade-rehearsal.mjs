#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = resolve(".");
const SCHEMA = join(ROOT, "database", "prisma", "schema.prisma");
const ACTIVE = join(ROOT, "database", "prisma", "migrations");
const STATE = join(ROOT, "database", "prisma", "state", "canonical-state.json");
const PRISMA_CLI = join(ROOT, "node_modules", "prisma", "build", "index.js");
const SENTINEL_ID = "phase2-migration-upgrade-sentinel";
const SENTINEL_EMAIL = "phase2-migration-upgrade-sentinel@invalid.local";

function fail(message) {
  throw new Error(`MIGRATION_UPGRADE_REHEARSAL_BLOCKED: ${message}`);
}

function countValue(rows) {
  return Number(rows[0]?.count ?? 0);
}

async function withPrisma(action) {
  const prisma = new PrismaClient();
  try {
    return await action(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

function runDeploy(schemaPath) {
  const result = spawnSync(
    process.execPath,
    [PRISMA_CLI, "migrate", "deploy", "--schema", schemaPath],
    {
      cwd: ROOT,
      env: process.env,
      encoding: "utf8",
      stdio: "inherit",
      windowsHide: true
    }
  );
  if (result.error) fail(`Prisma migrate deploy could not start: ${result.error.message}`);
  if (result.status !== 0)
    fail(`Prisma migrate deploy failed with exit ${result.status ?? "unknown"}.`);
}

function migrationNames() {
  return readdirSync(ACTIVE, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(ACTIVE, entry.name, "migration.sql")))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function copyMigration(name, targetDir) {
  cpSync(join(ACTIVE, name), join(targetDir, name), { recursive: true });
}

async function main() {
  if (process.env.MIGRATION_REHEARSAL_ALLOW !== "1") {
    fail("set MIGRATION_REHEARSAL_ALLOW=1 only for a disposable CI/test database.");
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail("DATABASE_URL is required.");
  const parsed = new URL(databaseUrl);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!/(?:^|_)(?:ci|test|rehearsal)(?:_|$)/i.test(databaseName)) {
    fail(`refusing non-disposable database '${databaseName}'.`);
  }
  if (!existsSync(PRISMA_CLI)) fail("local Prisma CLI is missing; run npm ci/install first.");

  const state = JSON.parse(readFileSync(STATE, "utf8"));
  const names = migrationNames();
  if (names.length < 2)
    fail("at least baseline + one forward migration are required for upgrade rehearsal.");
  if (names[0] !== state.baselineMigration) {
    fail(`active lineage does not start with ${state.baselineMigration}.`);
  }

  const existingTables = await withPrisma((prisma) =>
    prisma.$queryRawUnsafe(
      "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = DATABASE()"
    )
  );
  if (countValue(existingTables) !== 0) {
    fail(
      "target database is not empty; rehearsal never resets or overwrites an existing database."
    );
  }

  const tempRoot = mkdtempSync(join(tmpdir(), "ysabelle-migration-rehearsal-"));
  const tempSchema = join(tempRoot, "schema.prisma");
  const tempMigrations = join(tempRoot, "migrations");
  let sentinelCreated = false;

  try {
    mkdirSync(tempMigrations, { recursive: true });
    copyFileSync(SCHEMA, tempSchema);
    copyFileSync(join(ACTIVE, "migration_lock.toml"), join(tempMigrations, "migration_lock.toml"));
    copyMigration(state.baselineMigration, tempMigrations);

    console.log(
      `[migration-rehearsal] applying previous canonical base: ${state.baselineMigration}`
    );
    runDeploy(tempSchema);

    await withPrisma(async (prisma) => {
      await prisma.$executeRawUnsafe(
        `INSERT INTO users (id, name, email, password_hash, role, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'STAFF', 'ACTIVE', CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))`,
        SENTINEL_ID,
        "Migration Upgrade Sentinel",
        SENTINEL_EMAIL,
        "phase2-sentinel-not-a-login"
      );
    });
    sentinelCreated = true;

    for (const name of names.slice(1)) copyMigration(name, tempMigrations);

    console.log(
      `[migration-rehearsal] upgrading previous base to latest (${names.length} migrations total)`
    );
    runDeploy(tempSchema);

    await withPrisma(async (prisma) => {
      const sentinel = await prisma.$queryRawUnsafe(
        "SELECT COUNT(*) AS count FROM users WHERE id = ? AND email = ?",
        SENTINEL_ID,
        SENTINEL_EMAIL
      );
      if (countValue(sentinel) !== 1) fail("pre-upgrade sentinel row was not preserved.");

      const marker = await prisma.$queryRawUnsafe(
        `SELECT migration_epoch AS migrationEpoch,
                schema_version AS schemaVersion,
                catalog_version AS catalogVersion,
                asset_version AS assetVersion,
                release_id AS releaseId
           FROM system_canonical_state
          WHERE id = 1`
      );
      const row = marker[0];
      if (
        !row ||
        Number(row.migrationEpoch) !== state.migrationEpoch ||
        Number(row.schemaVersion) !== state.schemaVersion ||
        Number(row.catalogVersion) !== state.catalogVersion ||
        Number(row.assetVersion) !== state.assetVersion ||
        row.releaseId !== state.releaseId
      ) {
        fail("database canonical-state marker does not match canonical-state.json after upgrade.");
      }

      const applied = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) AS count
           FROM _prisma_migrations
          WHERE finished_at IS NOT NULL
            AND rolled_back_at IS NULL`
      );
      if (countValue(applied) !== names.length) {
        fail(`expected ${names.length} completed migrations, found ${countValue(applied)}.`);
      }

      const failed = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) AS count
           FROM _prisma_migrations
          WHERE finished_at IS NULL
             OR rolled_back_at IS NOT NULL`
      );
      if (countValue(failed) !== 0)
        fail("failed or rolled-back migration metadata exists after upgrade.");

      await prisma.$executeRawUnsafe("DELETE FROM users WHERE id = ?", SENTINEL_ID);
      sentinelCreated = false;
    });

    console.log(
      `MIGRATION_UPGRADE_REHEARSAL=PASS baseline=${state.baselineMigration} latest=${names.at(-1)} migrations=${names.length}`
    );
  } finally {
    if (sentinelCreated) {
      try {
        await withPrisma((prisma) =>
          prisma.$executeRawUnsafe("DELETE FROM users WHERE id = ?", SENTINEL_ID)
        );
      } catch {
        // Disposable CI/test DB only. Preserve the original failure.
      }
    }
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
