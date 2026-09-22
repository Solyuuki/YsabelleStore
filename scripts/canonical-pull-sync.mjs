#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const STATE_PATH = "database/prisma/state/canonical-state.json";
const BASELINE_MIGRATION = "0000_generation2_baseline";
const RELEVANT_PREFIXES = [
  "database/prisma/",
  "database/seed/",
  "database/canonical/",
  "frontend/public/images/products/"
];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    windowsHide: true
  });

  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const detail = options.capture
      ? (result.stderr || result.stdout || "").trim()
      : "";
    throw new Error(
      `${command} ${args.join(" ")} failed with exit ${result.status ?? "unknown"}${detail ? `: ${detail}` : ""}`
    );
  }

  return {
    status: result.status ?? 1,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim()
  };
}

function npm(args, options) {
  return run(process.platform === "win32" ? "npm.cmd" : "npm", args, options);
}

function git(args, options) {
  return run("git", args, { ...options, capture: true });
}

export function isRelevantCanonicalPath(path) {
  return RELEVANT_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function classifyDatabaseState({
  applicationTableCount,
  hasGeneration2Baseline,
  marker,
  target
}) {
  if (applicationTableCount === 0) return "EMPTY";
  if (!marker && hasGeneration2Baseline) return "GEN2_PRE_MARKER";
  if (!marker) return "LEGACY";
  if (Number(marker.migrationEpoch) !== target.migrationEpoch) return "DRIFTED";

  for (const key of ["schemaVersion", "catalogVersion", "assetVersion"]) {
    if (Number(marker[key]) > target[key]) return "AHEAD";
  }

  return "GEN2";
}

function changedFiles() {
  const previous = git(["rev-parse", "--verify", "ORIG_HEAD"], {
    allowFailure: true
  });
  if (previous.status !== 0) return [];

  const diff = git(["diff", "--name-only", "ORIG_HEAD", "HEAD"]);
  return diff.stdout ? diff.stdout.split(/\r?\n/).filter(Boolean) : [];
}

async function inspectDatabase(prisma) {
  const tableRows = await prisma.$queryRawUnsafe(
    "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name <> '_prisma_migrations'"
  );
  const applicationTableCount = Number(tableRows[0]?.count ?? 0);

  const migrationTableRows = await prisma.$queryRawUnsafe(
    "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = '_prisma_migrations'"
  );
  const migrationTableExists = Number(migrationTableRows[0]?.count ?? 0) === 1;

  let hasGeneration2Baseline = false;
  if (migrationTableExists) {
    const baselineRows = await prisma.$queryRawUnsafe(
      "SELECT COUNT(*) AS count FROM _prisma_migrations WHERE migration_name = ? AND finished_at IS NOT NULL AND rolled_back_at IS NULL",
      BASELINE_MIGRATION
    );
    hasGeneration2Baseline = Number(baselineRows[0]?.count ?? 0) === 1;
  }

  let marker = null;
  try {
    marker = await prisma.systemCanonicalState.findUnique({ where: { id: 1 } });
  } catch (error) {
    if (error?.code !== "P2021") throw error;
  }

  return { applicationTableCount, hasGeneration2Baseline, marker };
}

function printDistributionBlockers(state) {
  for (const blocker of state.distributionBlockers ?? []) {
    console.warn(`  - ${blocker}`);
  }
}

async function main() {
  const force = process.argv.includes("--force");
  const changed = force ? ["database/prisma/state/canonical-state.json"] : changedFiles();
  const relevant = changed.filter(isRelevantCanonicalPath);

  if (!force && relevant.length === 0) {
    console.log("CANONICAL_PULL_SYNC=NOOP");
    return;
  }

  const state = JSON.parse(readFileSync(STATE_PATH, "utf8"));

  console.log(
    `YSABELLE CANONICAL PULL SYNC target=${state.releaseId ?? "unknown"} changed=${relevant.length}`
  );

  npm(["run", "migration:security"]);
  npm(["run", "state:security"]);

  const schemaTouched = relevant.some(
    (path) =>
      path === state.schemaPath ||
      path.startsWith("database/prisma/migrations/")
  );
  if (schemaTouched) {
    npm(["run", "prisma:clean"]);
  }

  const { PrismaClient } = await import("@prisma/client");
  let prisma = new PrismaClient();

  try {
    const observed = await inspectDatabase(prisma);
    const classification = classifyDatabaseState({
      ...observed,
      target: state
    });

    console.log(`CANONICAL_PULL_DB_CLASS=${classification}`);

    if (classification === "AHEAD") {
      throw new Error(
        "Local canonical DB versions are ahead of the pulled repository. Refusing to downgrade."
      );
    }

    if (classification === "DRIFTED") {
      throw new Error(
        "Local canonical DB marker belongs to a different migration epoch. Recovery review is required."
      );
    }

    if (classification === "LEGACY" || classification === "EMPTY") {
      if (!state.distributionReady) {
        console.warn(
          `CANONICAL_PULL_SYNC=DEFERRED class=${classification}: canonical replacement package is not distribution-ready.`
        );
        printDistributionBlockers(state);
        return;
      }

      throw new Error(
        "Canonical replacement is marked ready, but destructive legacy/empty bootstrap is not enabled by this release."
      );
    }

    await prisma.$disconnect();
    prisma = null;

    npm([
      "exec",
      "--",
      "prisma",
      "migrate",
      "deploy",
      "--schema=database/prisma/schema.prisma"
    ]);

    prisma = new PrismaClient();
    const marker = await prisma.systemCanonicalState.findUnique({ where: { id: 1 } });
    if (!marker) {
      throw new Error("Generation 2 migration deploy completed without a canonical state marker.");
    }

    if (
      Number(marker.catalogVersion) !== state.catalogVersion ||
      Number(marker.assetVersion) !== state.assetVersion
    ) {
      console.warn(
        `CANONICAL_PULL_SYNC=DEFERRED_DELTA localCatalog=${marker.catalogVersion} targetCatalog=${state.catalogVersion} localAssets=${marker.assetVersion} targetAssets=${state.assetVersion}`
      );
      console.warn(
        "Schema migrations are current, but canonical data/asset deltas still require the distribution changeset layer."
      );
      return;
    }

    if (
      Number(marker.schemaVersion) !== state.schemaVersion ||
      marker.releaseId !== state.releaseId
    ) {
      await prisma.systemCanonicalState.update({
        where: { id: 1 },
        data: {
          schemaVersion: state.schemaVersion,
          releaseId: state.releaseId
        }
      });
    }

    console.log(
      `CANONICAL_PULL_SYNC=PASS schema=${state.schemaVersion} catalog=${state.catalogVersion} assets=${state.assetVersion}`
    );
  } finally {
    if (prisma) await prisma.$disconnect();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error("CANONICAL_PULL_SYNC=ERROR");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
