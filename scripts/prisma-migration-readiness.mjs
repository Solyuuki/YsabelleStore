#!/usr/bin/env node
/**
 * Static, read-only migration guard. No datasource, .env, Prisma CLI, or database access.
 * Exit 1 until migration history is demonstrably replayable and schema coverage is complete.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";

export function inspectMigrationSources(schema, migrations) {
  const findings = [];
  const tableCreators = new Map();
  const createTable = /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?([a-z_][a-z\d_]*)[`"]?/gi;
  const models = new Map();
  for (const match of schema.matchAll(/\bmodel\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const mapping = match[2].match(/@@map\("([a-z_][a-z\d_]*)"\)/i);
    models.set(mapping?.[1] ?? match[1], match[1]);
  }
  if (models.size === 0 || migrations.size === 0) {
    findings.push("BLOCK: Missing Prisma models or migration files; audit cannot proceed.");
    return findings;
  }
  const sorted = [...migrations].sort(([a], [b]) => a.localeCompare(b));
  for (const [migration, sql] of sorted) {
    // Avoid false positives from commented-out SQL declarations.
    const withoutComments = sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*--[^\n]*/gm, "");
    for (const match of withoutComments.matchAll(createTable)) {
      const table = match[1].toLowerCase();
      const previous = tableCreators.get(table);
      if (previous) {
        findings.push(
          `BLOCK: ${table} is created twice (${previous}, ${migration}). Do not modify applied migration files or replay this chain.`
        );
      } else {
        tableCreators.set(table, migration);
      }
    }
  }
  for (const [table, model] of models) {
    if (!tableCreators.has(table.toLowerCase())) {
      findings.push(
        `BLOCK: Prisma model ${model} maps to ${table}, but no historical migration creates that table.`
      );
    }
  }
  for (const [table, migration] of tableCreators) {
    if (!models.has(table)) {
      findings.push(
        `BLOCK: Migration ${migration} creates ${table}, absent from schema.prisma. A schema sync may propose dropping it.`
      );
    }
  }
  return findings;
}

export function inspectRepository(root) {
  const schemaPath = join(root, "database", "prisma", "schema.prisma");
  const dir = join(root, "database", "prisma", "migrations");
  if (!existsSync(schemaPath) || !existsSync(dir)) {
    return ["BLOCK: Prisma schema or migrations directory is missing."];
  }
  const migrations = new Map();
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = join(dir, entry.name, "migration.sql");
    if (existsSync(file)) migrations.set(entry.name, readFileSync(file, "utf8"));
  }
  return inspectMigrationSources(readFileSync(schemaPath, "utf8"), migrations);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  // Only support --root for pure filesystem inspection; no --apply or database mutation mode.
  const args = process.argv.slice(2);
  if (args.length !== 0 && !(args.length === 2 && args[0] === "--root")) {
    console.error("Usage: node scripts/prisma-migration-readiness.mjs [--root PATH]");
    process.exitCode = 2;
  } else {
    const findings = inspectRepository(resolve(args[1] ?? "."));
    if (findings.length) {
      for (const finding of findings) console.error(finding);
      console.error(`MIGRATION_READINESS=BLOCKED (${findings.length} source-level findings)`);
      console.error(
        "Read database/prisma/MIGRATION_RECOVERY.md; do not run migrate dev/deploy/reset or db push."
      );
      process.exitCode = 1;
    } else {
      console.log(
        "MIGRATION_SOURCE_CHECK=PASS; live schema, data, checksums and isolated replay still require verification."
      );
      console.log("MIGRATION_READINESS=NOT_YET_VERIFIED");
    }
  }
}
