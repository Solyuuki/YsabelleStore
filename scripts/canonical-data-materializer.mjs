#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeCanonicalText, sha256CanonicalText } from "./lib/canonical-text.mjs";

const ROOT = resolve("."),
  STATE = "database/prisma/state/canonical-state.json",
  RECON = "database/canonical/product-images/candidate-reconciliation.json";

export const CANONICAL_TABLES = [
  "categories",
  "products",
  "product_image_assets",
  "product_aliases",
  "sarima_source_product_mappings"
];

const hash = (v) => sha256CanonicalText(v);

export function extractInsertStatement(sql, table) {
  const start = sql.indexOf("INSERT INTO `" + table + "`");
  if (start < 0) throw new Error("Missing INSERT for " + table);
  let q = false,
    esc = false;
  for (let i = start; i < sql.length; i++) {
    const c = sql[i];
    if (q) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === "'") {
        if (sql[i + 1] === "'") i++;
        else q = false;
      }
    } else if (c === "'") q = true;
    else if (c === ";") return sql.slice(start, i + 1);
  }
  throw new Error("Unterminated INSERT for " + table);
}

function split(text) {
  const out = [];
  let start = 0,
    depth = 0,
    q = false,
    esc = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === "'") {
        if (text[i + 1] === "'") i++;
        else q = false;
      }
      continue;
    }
    if (c === "'") {
      q = true;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) {
      out.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(text.slice(start).trim());
  return out;
}

export function parseInsertStatement(st) {
  const marker = ") VALUES ",
    mi = st.indexOf(marker);
  if (mi < 0) throw new Error("Invalid INSERT");
  const m = st.slice(0, mi + 1).match(/^INSERT INTO `([^`]+)` \((.*)\)$/s);
  if (!m) throw new Error("Invalid INSERT header");
  const columns = split(m[2]).map((x) => x.replace(/^`|`$/g, "")),
    body = st.slice(mi + marker.length, -1).trim(),
    tuples = [];
  let start = -1,
    d = 0,
    q = false,
    esc = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (q) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === "'") {
        if (body[i + 1] === "'") i++;
        else q = false;
      }
      continue;
    }
    if (c === "'") {
      q = true;
      continue;
    }
    if (c === "(") {
      if (d === 0) start = i;
      d++;
    } else if (c === ")") {
      d--;
      if (d === 0) {
        const raw = body.slice(start, i + 1),
          values = split(raw.slice(1, -1));
        if (values.length !== columns.length) throw new Error(m[1] + " tuple width mismatch");
        tuples.push({ raw, values });
        start = -1;
      }
    }
  }
  return { table: m[1], columns, tuples };
}

export function decodeSqlValue(v) {
  v = v.trim();
  if (/^NULL$/i.test(v)) return null;
  if (!v.startsWith("'")) return v;
  return v.slice(1, -1).replace(/''/g, "'").replace(/\\'/g, "'").replace(/\\\\/g, "\\");
}

function value(p, t, c) {
  const i = p.columns.indexOf(c);
  if (i < 0) throw new Error(p.table + " missing " + c);
  return decodeSqlValue(t.values[i]);
}

function rowObject(parsed, tuple) {
  return Object.fromEntries(
    parsed.columns.map((column, index) => [column, decodeSqlValue(tuple.values[index])])
  );
}

function upsert(p, rows) {
  if (!rows.length) return null;
  const cols = p.columns.map((c) => "`" + c + "`").join(", "),
    updates = p.columns
      .filter((c) => c !== "id")
      .map((c) => "`" + c + "`=VALUES(`" + c + "`)")
      .join(", ");
  return (
    "INSERT INTO `" +
    p.table +
    "` (" +
    cols +
    ") VALUES\n" +
    rows.map((r) => r.raw).join(",\n") +
    "\nON DUPLICATE KEY UPDATE " +
    updates
  );
}

export function buildCanonicalSubset({ catalogSql, release, reconciliation }) {
  const p = Object.fromEntries(
      CANONICAL_TABLES.map((t) => [t, parseInsertStatement(extractInsertStatement(catalogSql, t))])
    ),
    productIds = new Set((release.products || []).map((x) => x.productId)),
    candidateIds = new Set((reconciliation.items || []).map((x) => x.candidateId));
  if (productIds.size !== 50 || candidateIds.size !== 50) {
    throw new Error("Production subset must contain 50 products/candidates");
  }
  const products = p.products.tuples.filter((t) => productIds.has(value(p.products, t, "id")));
  if (products.length !== 50) throw new Error("Selected product rows=" + products.length + "/50");
  const categoryIds = new Set(
    products.map((t) => value(p.products, t, "category_id")).filter(Boolean)
  );
  const selected = {
    categories: p.categories.tuples.filter((t) => categoryIds.has(value(p.categories, t, "id"))),
    products,
    product_image_assets: p.product_image_assets.tuples.filter((t) =>
      candidateIds.has(value(p.product_image_assets, t, "id"))
    ),
    product_aliases: p.product_aliases.tuples.filter((t) =>
      productIds.has(value(p.product_aliases, t, "canonical_product_id"))
    ),
    sarima_source_product_mappings: p.sarima_source_product_mappings.tuples.filter((t) =>
      productIds.has(value(p.sarima_source_product_mappings, t, "canonical_product_id"))
    )
  };
  if (
    selected.categories.length !== categoryIds.size ||
    selected.product_image_assets.length !== 50 ||
    selected.sarima_source_product_mappings.length !== 50
  ) {
    throw new Error("Canonical subset incomplete");
  }
  const ids = Object.fromEntries(
    Object.entries(selected).map(([t, rows]) => [t, rows.map((r) => value(p[t], r, "id"))])
  );
  const rows = Object.fromEntries(
    Object.entries(selected).map(([table, tuples]) => [
      table,
      tuples
        .map((tuple) => rowObject(p[table], tuple))
        .sort((left, right) => String(left.id).localeCompare(String(right.id)))
    ])
  );
  return {
    statements: CANONICAL_TABLES.map((t) => upsert(p[t], selected[t])).filter(Boolean),
    ids,
    rows,
    counts: Object.fromEntries(Object.entries(selected).map(([t, r]) => [t, r.length]))
  };
}

async function count(prisma, table, ids) {
  if (!ids.length) return 0;
  const rows = await prisma.$queryRawUnsafe(
    "SELECT COUNT(DISTINCT id) AS count FROM `" +
      table +
      "` WHERE id IN (" +
      ids.map(() => "?").join(",") +
      ")",
    ...ids
  );
  return Number(rows[0]?.count || 0);
}

export async function verifyCanonicalSubset(prisma, subset) {
  const f = [];
  for (const t of CANONICAL_TABLES) {
    const a = await count(prisma, t, subset.ids[t]),
      e = subset.ids[t].length;
    if (a !== e) f.push(t + ": " + a + "/" + e);
  }
  return f;
}

export async function inspectCanonicalDbDrift(prisma, subset) {
  const findings = [];
  for (const table of CANONICAL_TABLES) {
    const expectedRows = subset.rows?.[table] ?? [];
    if (!expectedRows.length) continue;
    const columns = Object.keys(expectedRows[0]);
    const select = columns
      .map(
        (column) =>
          "IF(`" + column + "` IS NULL,NULL,CAST(`" + column + "` AS CHAR)) AS `" + column + "`"
      )
      .join(",");
    const ids = expectedRows.map((row) => row.id);
    const actualRows = await prisma.$queryRawUnsafe(
      "SELECT " +
        select +
        " FROM `" +
        table +
        "` WHERE id IN (" +
        ids.map(() => "?").join(",") +
        ") ORDER BY id",
      ...ids
    );
    const actualById = new Map(actualRows.map((row) => [String(row.id), row]));
    for (const expected of expectedRows) {
      const actual = actualById.get(String(expected.id));
      if (!actual) {
        findings.push(table + "/" + expected.id + ": missing row");
        continue;
      }
      for (const column of columns) {
        const expectedValue = expected[column] === null ? null : String(expected[column]);
        const actualValue = actual[column] === null ? null : String(actual[column]);
        if (expectedValue !== actualValue) {
          findings.push(
            table +
              "/" +
              expected.id +
              "/" +
              column +
              ": repo=" +
              JSON.stringify(expectedValue) +
              " db=" +
              JSON.stringify(actualValue)
          );
        }
      }
    }
    if (actualRows.length !== expectedRows.length) {
      findings.push(
        table +
          ": canonical row count mismatch repo=" +
          expectedRows.length +
          " db=" +
          actualRows.length
      );
    }
  }
  return findings;
}

export async function applyCanonicalSubset(prisma, subset) {
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS=0");
      try {
        for (const s of subset.statements) await tx.$executeRawUnsafe(s);
      } finally {
        await tx.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS=1");
      }
    },
    { timeout: 120000 }
  );
  const f = await verifyCanonicalSubset(prisma, subset);
  if (f.length) throw new Error("Canonical data verification failed: " + f.join(", "));
}

export function loadCanonicalSubset(root = ROOT) {
  const state = JSON.parse(readFileSync(join(root, STATE))),
    release = JSON.parse(readFileSync(join(root, state.canonicalReleasePath))),
    reconciliation = JSON.parse(readFileSync(join(root, RECON))),
    bytes = readFileSync(join(root, state.canonicalCatalogPath)),
    catalogSql = normalizeCanonicalText(bytes);
  if (hash(catalogSql) !== state.canonicalCatalogSha256) {
    throw new Error("Canonical catalog checksum mismatch");
  }
  return {
    state,
    subset: buildCanonicalSubset({ catalogSql, release, reconciliation })
  };
}

async function main() {
  const { PrismaClient } = await import("@prisma/client"),
    prisma = new PrismaClient();
  try {
    const x = loadCanonicalSubset();
    if (process.argv.includes("--verify-only")) {
      const f = await verifyCanonicalSubset(prisma, x.subset);
      if (f.length) throw new Error(f.join(", "));
      console.log("CANONICAL_DATA_VERIFY=PASS products=" + x.subset.counts.products);
    } else {
      await applyCanonicalSubset(prisma, x.subset);
      console.log(
        "CANONICAL_DATA_MATERIALIZE=PASS products=" +
          x.subset.counts.products +
          " assets=" +
          x.subset.counts.product_image_assets
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((e) => {
    console.error("CANONICAL_DATA_MATERIALIZE=ERROR");
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
}
