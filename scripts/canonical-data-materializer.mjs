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

  const body = v.slice(1, -1);
  let decoded = "";
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];

    if (character === "'" && body[index + 1] === "'") {
      decoded += "'";
      index += 1;
      continue;
    }

    if (character !== "\\" || index + 1 >= body.length) {
      decoded += character;
      continue;
    }

    const escaped = body[index + 1];
    const replacements = {
      0: "\0",
      b: "\b",
      n: "\n",
      r: "\r",
      t: "\t",
      Z: "\x1a",
      "'": "'",
      '"': '"',
      "\\": "\\",
      "%": "%",
      _: "_"
    };
    decoded += replacements[escaped] ?? escaped;
    index += 1;
  }

  return decoded;
}

function encodeSqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return "'" + String(value).replaceAll("\\", "\\\\").replaceAll("'", "\\'") + "'";
}

function rewriteTuple(parsed, tuple, updates) {
  const values = [...tuple.values];
  for (const [column, nextValue] of Object.entries(updates)) {
    const index = parsed.columns.indexOf(column);
    if (index < 0) throw new Error(parsed.table + " missing " + column);
    values[index] = encodeSqlValue(nextValue);
  }
  return { values, raw: "(" + values.join(",") + ")" };
}

function canonicalBarcodeId(sourceProductId) {
  return "canonical-barcode-" + String(sourceProductId).toLowerCase();
}

function buildCanonicalBarcodeState(release) {
  const rows = (release.products || []).map((product) => ({
    id: canonicalBarcodeId(product.sourceProductId),
    product_id: product.productId,
    barcode: product.manufacturerBarcode,
    type: "MANUFACTURER",
    is_primary: "1",
    source: "VERIFIED_BOOTSTRAP",
    registered_by_id: null,
    source_reference: "canonical-release:" + release.releaseId + ":" + product.sourceProductId
  }));
  const productIds = rows.map((row) => encodeSqlValue(row.product_id)).join(",");
  const barcodes = rows.map((row) => encodeSqlValue(row.barcode)).join(",");
  const ids = rows.map((row) => encodeSqlValue(row.id)).join(",");
  const values = rows
    .map(
      (row) =>
        "(" +
        [
          row.id,
          row.product_id,
          row.barcode,
          row.type,
          Number(row.is_primary),
          row.source,
          row.registered_by_id,
          row.source_reference
        ]
          .map(encodeSqlValue)
          .join(",") +
        ",CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3))"
    )
    .join(",\n");

  return {
    rows,
    statements: [
      "UPDATE product_barcodes SET is_primary=0 WHERE product_id IN (" + productIds + ")",
      "DELETE FROM product_barcodes WHERE barcode IN (" + barcodes + ") OR id IN (" + ids + ")",
      "INSERT INTO product_barcodes " +
        "(id,product_id,barcode,type,is_primary,source,registered_by_id,source_reference,created_at,updated_at) VALUES\n" +
        values
    ]
  };
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

const JSON_COLUMNS = {
  product_aliases: new Set(["evidence"]),
  product_image_assets: new Set(["diagnostics"]),
  sarima_source_product_mappings: new Set(["evidence"])
};

const DECIMAL_COLUMNS = {
  products: new Set(["size_value", "cost_price", "selling_price"]),
  sarima_source_product_mappings: new Set(["source_selling_price"])
};

const STOREFRONT_CATEGORY_TAXONOMY = [
  {
    name: "Coffee & Milk",
    slug: "coffee-milk",
    sourceCategories: ["Beverages / Coffee & Milk"]
  },
  {
    name: "Juice, Tea, Soda & Water",
    slug: "juice-tea-soda-water",
    sourceCategories: ["Beverages / Juice, Tea, Soda & Water"]
  },
  { name: "Bread & Bakery", slug: "bread-bakery", sourceCategories: ["Bread & Bakery"] },
  {
    name: "Baking & Dessert",
    slug: "baking-dessert",
    sourceCategories: ["Baking / Spreads & Dessert Ingredients"]
  },
  { name: "Canned Goods", slug: "canned-goods", sourceCategories: ["Canned Goods"] },
  {
    name: "Condiments & Cooking",
    slug: "condiments-cooking",
    sourceCategories: ["Condiments & Cooking Ingredients"]
  },
  { name: "Noodles & Pasta", slug: "noodles-pasta", sourceCategories: ["Noodles & Pasta"] },
  { name: "Rice & Staples", slug: "rice-staples", sourceCategories: ["Rice & Staples"] },
  {
    name: "Snacks & Confectionery",
    slug: "snacks-confectionery",
    sourceCategories: ["Snacks / Biscuits & Confectionery"]
  },
  {
    name: "Frozen & Chilled",
    slug: "frozen-chilled",
    sourceCategories: ["Frozen / Chilled"]
  },
  {
    name: "Household Supplies",
    slug: "household-supplies",
    sourceCategories: ["Household Supplies"]
  },
  {
    name: "Laundry Supplies",
    slug: "laundry-supplies",
    sourceCategories: ["Laundry Supplies"]
  },
  {
    name: "Personal Care & Hygiene",
    slug: "personal-care-hygiene",
    sourceCategories: ["Personal Care / Hygiene"]
  },
  { name: "Tissue & Cotton", slug: "tissue-cotton", sourceCategories: ["Tissue & Cotton"] }
];

const storefrontCategoryBySource = new Map(
  STOREFRONT_CATEGORY_TAXONOMY.flatMap((category) =>
    category.sourceCategories.map((source) => [normalizeCategoryName(source), category])
  )
);

function normalizeCategoryName(value) {
  return String(value).trim().toLocaleLowerCase("en-US");
}

function buildStorefrontCategoryPlan(parsed, selectedMappings) {
  if (!parsed.sarima_source_product_mappings.columns.includes("source_category")) {
    return null;
  }

  const categoriesByName = new Map(
    parsed.categories.tuples.map((tuple) => [
      normalizeCategoryName(value(parsed.categories, tuple, "name")),
      tuple
    ])
  );
  const categoryByProductId = new Map();
  const selectedCategories = new Map();

  for (const mapping of selectedMappings) {
    const productId = value(parsed.sarima_source_product_mappings, mapping, "canonical_product_id");
    const sourceCategory = value(parsed.sarima_source_product_mappings, mapping, "source_category");
    const taxonomy = storefrontCategoryBySource.get(normalizeCategoryName(sourceCategory));
    if (!taxonomy) {
      throw new Error(
        "Unsupported canonical storefront source category for " + productId + ": " + sourceCategory
      );
    }

    const publicTuple =
      categoriesByName.get(normalizeCategoryName(taxonomy.name)) ??
      categoriesByName.get(normalizeCategoryName(sourceCategory));
    if (!publicTuple) {
      throw new Error(
        "Canonical storefront category row missing for " + productId + ": " + sourceCategory
      );
    }

    const rewritten = rewriteTuple(parsed.categories, publicTuple, {
      name: taxonomy.name,
      slug: taxonomy.slug,
      is_active: 1,
      data_quality_status: "APPROVED",
      is_storefront_visible: 1
    });
    const categoryId = value(parsed.categories, publicTuple, "id");
    selectedCategories.set(categoryId, rewritten);
    categoryByProductId.set(productId, categoryId);
  }

  return {
    categoryByProductId,
    categories: [...selectedCategories.values()]
  };
}

function normalizeDecimalText(value) {
  const text = String(value).trim();
  const match = text.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) return text;

  const sign = match[1];
  const integer = match[2].replace(/^0+(?=\d)/, "");
  const fraction = (match[3] ?? "").replace(/0+$/, "");
  return sign + integer + (fraction ? "." + fraction : "");
}

function stableJsonValue(value) {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableJsonValue(value[key])])
    );
  }
  return value;
}

export function normalizeCanonicalDbValue(table, column, value) {
  if (value === null || value === undefined) return null;
  const text = String(value);

  if (DECIMAL_COLUMNS[table]?.has(column)) {
    return normalizeDecimalText(text);
  }
  if (!JSON_COLUMNS[table]?.has(column)) return text;

  try {
    return JSON.stringify(stableJsonValue(JSON.parse(text)));
  } catch {
    return text;
  }
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
  const releaseByProductId = new Map(
    (release.products || []).map((product) => [product.productId, product])
  );
  const selectedMappings = p.sarima_source_product_mappings.tuples.filter((tuple) =>
    productIds.has(value(p.sarima_source_product_mappings, tuple, "canonical_product_id"))
  );
  const storefrontCategories = buildStorefrontCategoryPlan(p, selectedMappings);
  const products = p.products.tuples
    .filter((tuple) => productIds.has(value(p.products, tuple, "id")))
    .map((tuple) => {
      const productId = value(p.products, tuple, "id");
      const releaseProduct = releaseByProductId.get(productId);
      if (!releaseProduct) throw new Error("Canonical release product missing for " + productId);
      if (
        !releaseProduct.name?.trim() ||
        !releaseProduct.description?.trim() ||
        !releaseProduct.manufacturerBarcode?.trim() ||
        !releaseProduct.brand?.trim() ||
        !releaseProduct.variant?.trim()
      ) {
        throw new Error("Canonical release product metadata incomplete for " + productId);
      }
      const hasSizeValue =
        releaseProduct.sizeValue !== null && releaseProduct.sizeValue !== undefined;
      const hasSizeUnit = releaseProduct.sizeUnit !== null && releaseProduct.sizeUnit !== undefined;
      if (hasSizeValue !== hasSizeUnit) {
        throw new Error("Canonical release package size incomplete for " + productId);
      }

      return rewriteTuple(p.products, tuple, {
        category_id:
          storefrontCategories?.categoryByProductId.get(productId) ??
          value(p.products, tuple, "category_id"),
        active_image_asset_id:
          releaseProduct.catalogImage?.activeImageAssetId ??
          value(p.products, tuple, "active_image_asset_id"),
        sku: releaseProduct.sku,
        barcode: releaseProduct.manufacturerBarcode,
        name: releaseProduct.name,
        description: releaseProduct.description,
        image_url:
          releaseProduct.catalogImage?.legacyImageUrl ?? value(p.products, tuple, "image_url"),
        brand: releaseProduct.brand,
        variant: releaseProduct.variant,
        size_value: releaseProduct.sizeValue ?? null,
        size_unit: releaseProduct.sizeUnit ?? null,
        status: "ACTIVE",
        data_quality_status: "APPROVED",
        is_storefront_visible: 1
      });
    });
  if (products.length !== 50) throw new Error("Selected product rows=" + products.length + "/50");
  const categoryIds = new Set(
    products.map((t) => value(p.products, t, "category_id")).filter(Boolean)
  );
  const categories =
    storefrontCategories?.categories ??
    p.categories.tuples
      .filter((tuple) => categoryIds.has(value(p.categories, tuple, "id")))
      .map((tuple) =>
        rewriteTuple(p.categories, tuple, {
          is_active: 1,
          data_quality_status: "APPROVED",
          is_storefront_visible: 1
        })
      );
  const selected = {
    categories,
    products,
    product_image_assets: p.product_image_assets.tuples.filter((t) =>
      candidateIds.has(value(p.product_image_assets, t, "id"))
    ),
    product_aliases: p.product_aliases.tuples.filter((t) =>
      productIds.has(value(p.product_aliases, t, "canonical_product_id"))
    ),
    sarima_source_product_mappings: selectedMappings
  };
  if (
    selected.categories.length !== categoryIds.size ||
    selected.product_image_assets.length !== 50 ||
    selected.sarima_source_product_mappings.length !== 50
  ) {
    throw new Error("Canonical subset incomplete");
  }
  const barcodeState = buildCanonicalBarcodeState(release);
  if (barcodeState.rows.length !== 50) {
    throw new Error("Canonical barcode subset must contain exactly 50 rows");
  }

  const ids = Object.fromEntries(
    Object.entries(selected).map(([t, rows]) => [t, rows.map((r) => value(p[t], r, "id"))])
  );
  ids.product_barcodes = barcodeState.rows.map((row) => row.id);

  const rows = Object.fromEntries(
    Object.entries(selected).map(([table, tuples]) => [
      table,
      tuples
        .map((tuple) => rowObject(p[table], tuple))
        .sort((left, right) => String(left.id).localeCompare(String(right.id)))
    ])
  );
  rows.product_barcodes = [...barcodeState.rows].sort((left, right) =>
    String(left.id).localeCompare(String(right.id))
  );

  const counts = Object.fromEntries(Object.entries(selected).map(([t, r]) => [t, r.length]));
  counts.product_barcodes = barcodeState.rows.length;

  return {
    statements: [
      ...CANONICAL_TABLES.map((t) => upsert(p[t], selected[t])).filter(Boolean),
      ...barcodeState.statements
    ],
    ids,
    rows,
    counts
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
  for (const [table, ids] of Object.entries(subset.ids)) {
    const actual = await count(prisma, table, ids);
    const expected = ids.length;
    if (actual !== expected) f.push(table + ": " + actual + "/" + expected);
  }
  f.push(...(await inspectCanonicalDbDrift(prisma, subset)));
  return f;
}

export async function inspectCanonicalDbDrift(prisma, subset) {
  const findings = [];
  for (const table of Object.keys(subset.rows ?? {})) {
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
        const expectedValue = normalizeCanonicalDbValue(table, column, expected[column]);
        const actualValue = normalizeCanonicalDbValue(table, column, actual[column]);
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
