#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { sha256CanonicalText } from "./lib/canonical-text.mjs";
const root = resolve("."),
  dir = join(root, "database", "prisma", "migrations"),
  file = join(root, "database", "prisma", "state", "migration-checksums.json");
if (!process.argv.includes("--add-new")) {
  console.error("Usage: node scripts/migration-checksums.mjs --add-new");
  process.exit(2);
}
const m = JSON.parse(readFileSync(file, "utf8"));
m.migrations ??= {};
let added = 0;
for (const e of readdirSync(dir, { withFileTypes: true })) {
  if (!e.isDirectory()) continue;
  const f = join(dir, e.name, "migration.sql");
  if (!existsSync(f)) continue;
  const digest = sha256CanonicalText(readFileSync(f, "utf8"));
  if (m.migrations[e.name]) {
    if (m.migrations[e.name] !== digest) {
      console.error(
        `BLOCK: existing frozen checksum changed for ${e.name}; refusing to rewrite it.`
      );
      process.exit(1);
    }
    continue;
  }
  m.migrations[e.name] = digest;
  added++;
}
m.migrations = Object.fromEntries(
  Object.entries(m.migrations).sort(([a], [b]) => a.localeCompare(b))
);
writeFileSync(file, JSON.stringify(m, null, 2) + "\n", "utf8");
console.log(`MIGRATION_CHECKSUMS_ADDED=${added}`);
