import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import { prisma } from "../database/prismaClient.js";

const TARGET_MIGRATIONS = [
  "20260827040000_customer_password_recovery",
  "20260829071000_customer_social_auth",
  "20260831170000_customer_verified_identity_quick_sign",
  "20260831190000_customer_remembered_quick_sign"
] as const;

type TargetMigration = (typeof TARGET_MIGRATIONS)[number];
type MigrationRow = { migrationName: string };

function runVerifiedSchemaDoctor() {
  const doctorScript = path.resolve("backend/src/scripts/reconcileLocalMigrationHistory.ts");
  const result = spawnSync(process.execPath, ["--import", "tsx", doctorScript], {
    encoding: "utf8",
    env: process.env,
    stdio: "inherit"
  });

  if (result.error) {
    throw new Error(`Unable to run migration-history doctor: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(
      `Migration-history doctor did not clear the live schema for baselining (exit ${result.status ?? "unknown"}).`
    );
  }
}

async function getAppliedMigrationNames() {
  const rows = await prisma.$queryRaw<MigrationRow[]>`
    SELECT migration_name AS migrationName
    FROM _prisma_migrations
    WHERE finished_at IS NOT NULL
      AND rolled_back_at IS NULL
  `;

  return new Set(rows.map((row) => row.migrationName));
}

function resolveApplied(migration: TargetMigration) {
  const prismaCli = path.resolve("node_modules/prisma/build/index.js");

  if (!existsSync(prismaCli)) {
    throw new Error(
      `Local Prisma CLI was not found at ${prismaCli}. Run npm install before migration reconciliation.`
    );
  }

  const result = spawnSync(
    process.execPath,
    [
      prismaCli,
      "migrate",
      "resolve",
      "--applied",
      migration,
      "--schema",
      "database/prisma/schema.prisma"
    ],
    {
      encoding: "utf8",
      env: process.env,
      stdio: "pipe"
    }
  );

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.error) {
    throw new Error(`Unable to mark ${migration} as applied: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`Unable to mark ${migration} as applied (exit ${result.status ?? "unknown"}).`);
  }
}

async function main() {
  console.info("Re-verifying historical migration contracts before changing migration metadata...");
  runVerifiedSchemaDoctor();

  const applied = await getAppliedMigrationNames();

  for (const migration of TARGET_MIGRATIONS) {
    if (applied.has(migration)) {
      console.info(`Already applied; leaving unchanged: ${migration}`);
      continue;
    }

    console.info(`Marking verified historical migration as applied: ${migration}`);
    resolveApplied(migration);
    applied.add(migration);
  }

  const verifiedApplied = await getAppliedMigrationNames();
  const missing = TARGET_MIGRATIONS.filter((migration) => !verifiedApplied.has(migration));

  if (missing.length > 0) {
    throw new Error(`Migration history verification failed after reconciliation: ${missing.join(", ")}`);
  }

  console.info("MIGRATION_HISTORY_RECONCILIATION=APPLIED");
  console.info(
    "Only verified Prisma migration metadata was reconciled; application tables and business data were not modified by this helper."
  );
}

main()
  .catch((error) => {
    console.error("MIGRATION_HISTORY_RECONCILIATION=ERROR");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
