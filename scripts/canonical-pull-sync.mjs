#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";
import { resolveNpmInvocation } from "./lib/npm-invocation.mjs";
import {
  ensureAssetReconstructionRuntime,
  loadAssetDistribution,
  materializeAssetPayload,
  verifyMaterializedAssets
} from "./canonical-asset-materializer.mjs";
import {
  applyCanonicalSubset,
  loadCanonicalSubset,
  verifyCanonicalSubset
} from "./canonical-data-materializer.mjs";
import { backupDatabase, resetDatabaseToGeneration2 } from "./canonical-database-recovery.mjs";
import {
  shouldSyncDevelopmentTeamState,
  syncDevelopmentTeamState,
  verifyDevelopmentTeamState
} from "./canonical-team-development-state.mjs";

const STATE_PATH = "database/prisma/state/canonical-state.json",
  BASELINE = "0000_generation2_baseline";
const PREFIXES = [
  "database/prisma/",
  "database/seed/",
  "database/canonical/",
  "catalog-image-engine/",
  "scripts/canonical-",
  "frontend/public/images/products/"
];
function run(
  cmd,
  args,
  { capture = false, allowFailure = false, env = process.env, shell = false } = {}
) {
  const r = spawnSync(cmd, args, {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    windowsHide: true,
    shell
  });
  if (r.error) throw r.error;
  if (r.status !== 0 && !allowFailure)
    throw new Error(
      cmd +
        " " +
        args.join(" ") +
        " failed (" +
        (r.status === null ? "unknown" : r.status) +
        ")" +
        (capture ? ": " + (r.stderr || r.stdout || "").trim() : "")
    );
  return {
    status: r.status ?? 1,
    stdout: (r.stdout || "").trim(),
    stderr: (r.stderr || "").trim()
  };
}
const npm = (args, options = {}) => {
  const invocation = resolveNpmInvocation(args);
  return run(invocation.command, invocation.args, { ...options, shell: invocation.shell });
};
const git = (args, options) => run("git", args, { ...options, capture: true });
export function isRelevantCanonicalPath(path) {
  return PREFIXES.some((p) => path.startsWith(p));
}
export function requiresPrismaRegeneration(paths, state) {
  return paths.some(
    (path) => path === state.schemaPath || path.startsWith("database/prisma/migrations/")
  );
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
  for (const k of ["schemaVersion", "catalogVersion", "assetVersion"])
    if (Number(marker[k]) > target[k]) return "AHEAD";
  return "GEN2";
}
function changedFiles() {
  const old = git(["rev-parse", "--verify", "ORIG_HEAD"], { allowFailure: true });
  if (old.status !== 0) return [];
  const d = git(["diff", "--name-only", "ORIG_HEAD", "HEAD"]);
  return d.stdout ? d.stdout.split(/\r?\n/).filter(Boolean) : [];
}
export async function inspectDatabase(prisma) {
  const tables = await prisma.$queryRawUnsafe(
    "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name<>'_prisma_migrations'"
  );
  const mt = await prisma.$queryRawUnsafe(
    "SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='_prisma_migrations'"
  );
  let hasGeneration2Baseline = false;
  if (Number(mt[0]?.count || 0) === 1) {
    const r = await prisma.$queryRawUnsafe(
      "SELECT COUNT(*) AS count FROM _prisma_migrations WHERE migration_name=? AND finished_at IS NOT NULL AND rolled_back_at IS NULL",
      BASELINE
    );
    hasGeneration2Baseline = Number(r[0]?.count || 0) === 1;
  }
  let marker = null;
  try {
    marker = await prisma.systemCanonicalState.findUnique({ where: { id: 1 } });
  } catch (e) {
    if (e?.code !== "P2021") throw e;
  }
  return { applicationTableCount: Number(tables[0]?.count || 0), hasGeneration2Baseline, marker };
}
async function withPrisma(PrismaClient, fn) {
  const p = new PrismaClient();
  try {
    return await fn(p);
  } finally {
    await p.$disconnect();
  }
}
async function confirmRecovery(kind) {
  if (
    process.argv.includes("--confirm-recovery") ||
    process.env.YSABELLE_CANONICAL_RECOVERY_CONFIRM === "1"
  )
    return;
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new Error(kind + " recovery requires explicit confirmation (--confirm-recovery).");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    console.warn("Recovery class=" + kind + ". A full SQL backup is mandatory before reset.");
    const a = await rl.question("Type RECOVER to continue: ");
    if (a.trim() !== "RECOVER") throw new Error("Canonical recovery cancelled.");
  } finally {
    rl.close();
  }
}
async function updateMarker(prisma, state) {
  await prisma.systemCanonicalState.update({
    where: { id: 1 },
    data: {
      migrationEpoch: state.migrationEpoch,
      schemaVersion: state.schemaVersion,
      catalogVersion: state.catalogVersion,
      assetVersion: state.assetVersion,
      releaseId: state.releaseId
    }
  });
}
async function verifyReady(prisma, state, subset, plan) {
  const m = await prisma.systemCanonicalState.findUnique({ where: { id: 1 } });
  if (
    !m ||
    Number(m.migrationEpoch) !== state.migrationEpoch ||
    Number(m.schemaVersion) !== state.schemaVersion ||
    Number(m.catalogVersion) !== state.catalogVersion ||
    Number(m.assetVersion) !== state.assetVersion ||
    m.releaseId !== state.releaseId
  )
    throw new Error("Canonical marker mismatch after convergence.");
  const df = await verifyCanonicalSubset(prisma, subset);
  if (df.length) throw new Error("Canonical data verification failed: " + df.join(", "));
  const af = verifyMaterializedAssets(plan);
  if (af.length) throw new Error("Canonical asset verification failed: " + af.join("\n"));
  if (shouldSyncDevelopmentTeamState()) {
    const tf = await verifyDevelopmentTeamState(prisma);
    if (tf.length) throw new Error("Development team state verification failed: " + tf.join(", "));
  }
}
async function materialize({ PrismaClient, state, allowUnready }) {
  const data = loadCanonicalSubset(),
    assets = loadAssetDistribution();
  if ((!state.distributionReady || !assets.distribution.distributionPayloadReady) && !allowUnready)
    throw new Error("Canonical distribution is not activated.");
  ensureAssetReconstructionRuntime(assets);
  await withPrisma(PrismaClient, (p) => applyCanonicalSubset(p, data.subset));
  const assetResult = materializeAssetPayload({
    state,
    distribution: assets.distribution,
    plan: assets.plan,
    runtimeRoot: assets.runtimeRoot
  });
  let teamStateStatus = "SKIPPED";
  if (shouldSyncDevelopmentTeamState()) {
    const teamState = await withPrisma(PrismaClient, (p) => syncDevelopmentTeamState(p));
    teamStateStatus = teamState.status;
  }
  await withPrisma(PrismaClient, async (p) => {
    await updateMarker(p, state);
    await verifyReady(p, state, data.subset, assets.plan);
  });
  return { ...assetResult, teamStateStatus };
}
async function recover({ PrismaClient, state, classification, allowUnready }) {
  await confirmRecovery(classification);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL required for recovery.");
  ensureAssetReconstructionRuntime(loadAssetDistribution());
  const backup = backupDatabase({ databaseUrl, classification, releaseId: state.releaseId });
  console.log("CANONICAL_RECOVERY_BACKUP=" + backup);
  resetDatabaseToGeneration2();
  const result = await materialize({ PrismaClient, state, allowUnready });
  npm(["run", "prisma:generate"]);
  console.log("CANONICAL_RECOVERY=PASS class=" + classification);
  return result;
}
function blockers(state) {
  for (const b of state.distributionBlockers || []) console.warn("  - " + b);
}
async function main() {
  const force = process.argv.includes("--force"),
    allowUnready =
      process.argv.includes("--allow-unready-rehearsal") ||
      process.env.YSABELLE_PHASE4_ALLOW_UNREADY_REHEARSAL === "1",
    changed = force ? [STATE_PATH] : changedFiles(),
    relevant = changed.filter(isRelevantCanonicalPath);
  if (!force && !relevant.length) {
    console.log("CANONICAL_PULL_SYNC=NOOP");
    return;
  }
  const state = JSON.parse(readFileSync(STATE_PATH, "utf8"));
  console.log(
    "YSABELLE CANONICAL PULL SYNC target=" + state.releaseId + " changed=" + relevant.length
  );
  for (const task of [
    "migration:security",
    "state:security",
    "release:security",
    "candidate-reconciliation:security",
    "asset-distribution:security"
  ])
    npm(["run", task]);
  if (requiresPrismaRegeneration(relevant, state)) {
    npm(["run", "prisma:clean"]);
  }
  const { PrismaClient } = await import("@prisma/client");
  let observed = await withPrisma(PrismaClient, (p) => inspectDatabase(p)),
    kind = classifyDatabaseState({ ...observed, target: state });
  console.log("CANONICAL_PULL_DB_CLASS=" + kind);
  if (kind === "AHEAD") throw new Error("Local canonical DB is ahead; refusing downgrade.");
  if (kind === "DRIFTED")
    throw new Error("Local canonical DB belongs to a different migration epoch.");
  if (kind === "LEGACY" || kind === "EMPTY") {
    if (!state.distributionReady && !allowUnready) {
      console.warn("CANONICAL_PULL_SYNC=DEFERRED class=" + kind);
      blockers(state);
      return;
    }
    const r = await recover({ PrismaClient, state, classification: kind, allowUnready });
    console.log(
      "CANONICAL_PULL_SYNC=PASS assetsResult=" +
        r.status +
        " teamState=" +
        r.teamStateStatus
    );
    return;
  }
  npm(["exec", "--", "prisma", "migrate", "deploy", "--schema=database/prisma/schema.prisma"]);
  observed = await withPrisma(PrismaClient, (p) => inspectDatabase(p));
  kind = classifyDatabaseState({ ...observed, target: state });
  if (kind !== "GEN2") throw new Error("Unexpected post-migration class: " + kind);
  if (!state.distributionReady && !allowUnready) {
    const m = observed.marker;
    if (
      Number(m?.catalogVersion) !== state.catalogVersion ||
      Number(m?.assetVersion) !== state.assetVersion
    ) {
      console.warn("CANONICAL_PULL_SYNC=DEFERRED_DELTA");
      blockers(state);
      return;
    }
  }
  const r = await materialize({ PrismaClient, state, allowUnready });
  console.log(
    "CANONICAL_PULL_SYNC=PASS schema=" +
      state.schemaVersion +
      " catalog=" +
      state.catalogVersion +
      " assets=" +
      state.assetVersion +
      " assetsResult=" +
      r.status +
      " teamState=" +
      r.teamStateStatus
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch((e) => {
    console.error("CANONICAL_PULL_SYNC=ERROR");
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
