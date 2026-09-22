#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(".");
export const sha256 = (text) => createHash("sha256").update(text, "utf8").digest("hex");
export const gitBlobOid = (value) => {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
  const header = Buffer.from(`blob ${buffer.length}\0`, "utf8");
  return createHash("sha1").update(header).update(buffer).digest("hex");
};
export const stripSqlComments = (sql) =>
  sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*--[^\n]*/gm, "");

export function readMigrationMap(directory) {
  const out = new Map();
  if (!existsSync(directory)) return out;
  for (const e of readdirSync(directory, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const f = join(directory, e.name, "migration.sql");
    if (existsSync(f)) out.set(e.name, readFileSync(f, "utf8"));
  }
  return out;
}

export function findDestructiveStatements(migration, sql) {
  const findings = [];
  const statements = stripSqlComments(sql)
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    const normalized = statement.replace(/\s+/g, " ").toUpperCase();
    const reason = /\bDROP\s+DATABASE\b/.test(normalized)
      ? "DROP DATABASE"
      : /\bDROP\s+TABLE\b/.test(normalized)
        ? "DROP TABLE"
        : /\bTRUNCATE\s+(?:TABLE\s+)?/.test(normalized)
          ? "TRUNCATE"
          : /\bRENAME\s+TABLE\b/.test(normalized)
            ? "RENAME TABLE"
            : /\bALTER\s+TABLE\b/.test(normalized) && /\bDROP\s+COLUMN\b/.test(normalized)
              ? "DROP COLUMN"
              : null;

    if (reason) {
      findings.push(
        `BLOCK: destructive SQL (${reason}) is not allowed in active migration ${migration}; use an explicitly reviewed recovery/cutover procedure instead.`
      );
      continue;
    }

    if (/\bALTER\s+TABLE\b/.test(normalized)) {
      const drop = normalized.match(/\bDROP\s+(`?[A-Z0-9_]+`?)/);
      const token = drop?.[1]?.replaceAll("`", "") ?? null;
      if (
        token &&
        !new Set(["INDEX", "KEY", "FOREIGN", "PRIMARY", "CONSTRAINT", "CHECK"]).has(token)
      ) {
        findings.push(
          `BLOCK: destructive SQL (ALTER TABLE DROP ${token}) is not allowed in active migration ${migration}.`
        );
      }
    }
  }

  return findings;
}

export function inspectGeneration2({
  schema,
  active,
  archiveNames,
  archive = new Map(),
  state,
  checksums,
  legacyBlobs = null,
  migrationLock = 'provider = "mysql"'
}) {
  const findings = [];

  if (state.migrationEpoch !== 2)
    findings.push("BLOCK: canonical state is not Migration Generation 2.");
  if (state.baselineMigration !== "0000_generation2_baseline")
    findings.push("BLOCK: canonical baseline identifier is unexpected.");
  if (!/provider\s*=\s*["']mysql["']/i.test(migrationLock))
    findings.push("BLOCK: migration_lock.toml must pin the active lineage to MySQL.");

  if (checksums?.formatVersion !== 1 || checksums?.algorithm !== "sha256")
    findings.push("BLOCK: active migration checksum manifest format/algorithm is invalid.");
  if (checksums?.migrationEpoch !== state.migrationEpoch)
    findings.push("BLOCK: active migration checksum manifest epoch differs from canonical state.");

  const names = [...active.keys()].sort();
  if (names[0] !== state.baselineMigration)
    findings.push(`BLOCK: active lineage must start with ${state.baselineMigration}.`);
  for (const name of names) {
    if (!/^\d{4}(?:\d{10})?_[a-z0-9_]+$/.test(name))
      findings.push(`BLOCK: active migration name is not canonical/orderable: ${name}.`);
    if (archiveNames.has(name)) findings.push(`BLOCK: legacy migration ${name} is active again.`);
  }

  const models = new Map();
  for (const m of schema.matchAll(/\bmodel\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const map = m[2].match(/@@map\("([a-z_][a-z\d_]*)"\)/i);
    models.set((map?.[1] ?? m[1]).toLowerCase(), m[1]);
  }

  const creators = new Map();
  const createTable = /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?([a-z_][a-z\d_]*)[`"]?/gi;
  for (const [migration, raw] of active) {
    for (const m of stripSqlComments(raw).matchAll(createTable)) {
      const table = m[1].toLowerCase();
      const previous = creators.get(table);
      if (previous) findings.push(`BLOCK: ${table} is created twice (${previous}, ${migration}).`);
      else creators.set(table, migration);
    }
    if (migration !== state.baselineMigration) {
      findings.push(...findDestructiveStatements(migration, raw));
    }
  }

  for (const [table, model] of models) {
    if (!creators.has(table))
      findings.push(
        `BLOCK: Prisma model ${model} maps to ${table}, but active migrations never create it.`
      );
  }
  for (const [table, migration] of creators) {
    if (!models.has(table))
      findings.push(
        `BLOCK: active migration ${migration} creates ${table}, absent from schema.prisma.`
      );
  }

  const frozen = checksums?.migrations ?? {};
  for (const [name, sql] of active) {
    if (!frozen[name])
      findings.push(
        `BLOCK: active migration ${name} has no frozen checksum. Run migration:checksums:add only after review.`
      );
    else if (sha256(sql) !== frozen[name])
      findings.push(`BLOCK: frozen migration checksum changed: ${name}.`);
  }
  for (const name of Object.keys(frozen)) {
    if (!active.has(name))
      findings.push(`BLOCK: checksum manifest references missing active migration ${name}.`);
  }

  if (legacyBlobs) {
    if (legacyBlobs.formatVersion !== 1 || legacyBlobs.algorithm !== "git-blob-sha1") {
      findings.push("BLOCK: legacy migration fingerprint manifest format/algorithm is invalid.");
    }
    const expected = new Map((legacyBlobs.migrations ?? []).map((entry) => [entry.name, entry]));
    for (const [name, sql] of archive) {
      const entry = expected.get(name);
      if (!entry) {
        findings.push(`BLOCK: unregistered migration exists in Generation 1 archive: ${name}.`);
        continue;
      }
      const bytes = Buffer.byteLength(sql, "utf8");
      if (bytes !== entry.size || gitBlobOid(sql) !== entry.gitBlobOid) {
        findings.push(`BLOCK: Generation 1 archived migration changed: ${name}.`);
      }
    }
    for (const name of expected.keys()) {
      if (!archive.has(name))
        findings.push(`BLOCK: Generation 1 archived migration is missing: ${name}.`);
    }
  }

  const all = [...active.values()].join("\n");
  if (
    !/CONSTRAINT\s+`?chk_product_reviews_rating`?\s+CHECK\s*\(\s*`?rating`?\s+BETWEEN\s+1\s+AND\s+5\s*\)/i.test(
      all
    )
  )
    findings.push("BLOCK: product review rating CHECK contract is missing.");
  if (
    !/`updated_at`\s+DATETIME\(3\)\s+NOT\s+NULL\s+DEFAULT\s+CURRENT_TIMESTAMP\(3\)\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP\(3\)/i.test(
      all
    )
  )
    findings.push("BLOCK: customer_saved_addresses.updated_at ON UPDATE contract is missing.");

  return findings;
}

export function inspectRepository(root = ROOT) {
  const schema = join(root, "database", "prisma", "schema.prisma");
  const activeDir = join(root, "database", "prisma", "migrations");
  const migrationLockPath = join(activeDir, "migration_lock.toml");
  const archiveDir = join(root, "database", "prisma", "migration-history-archive", "generation-1");
  const statePath = join(root, "database", "prisma", "state", "canonical-state.json");
  const checksumsPath = join(root, "database", "prisma", "state", "migration-checksums.json");
  const legacyBlobsPath = join(root, "database", "prisma", "state", "legacy-migration-blobs.json");

  for (const path of [
    schema,
    activeDir,
    migrationLockPath,
    archiveDir,
    statePath,
    checksumsPath,
    legacyBlobsPath
  ]) {
    if (!existsSync(path)) return [`BLOCK: required migration-security source is missing: ${path}`];
  }

  const active = readMigrationMap(activeDir);
  const archive = readMigrationMap(archiveDir);
  if (active.size === 0) return ["BLOCK: no active migrations found."];

  return inspectGeneration2({
    schema: readFileSync(schema, "utf8"),
    active,
    archive,
    archiveNames: new Set(archive.keys()),
    state: JSON.parse(readFileSync(statePath, "utf8")),
    checksums: JSON.parse(readFileSync(checksumsPath, "utf8")),
    legacyBlobs: JSON.parse(readFileSync(legacyBlobsPath, "utf8")),
    migrationLock: readFileSync(migrationLockPath, "utf8")
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const findings = inspectRepository();
  if (findings.length) {
    for (const finding of findings) console.error(finding);
    console.error(`MIGRATION_SECURITY=BLOCKED (${findings.length} findings)`);
    process.exitCode = 1;
  } else {
    console.log("MIGRATION_SECURITY=PASS");
    console.log(
      "Generation 1 is fingerprint-frozen and isolated; Generation 2 ordering, checksums, non-destructive policy, model coverage, MySQL lock, and required raw-SQL contracts are valid."
    );
  }
}
