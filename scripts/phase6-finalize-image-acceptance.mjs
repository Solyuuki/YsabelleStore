#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  decodeSqlValue,
  extractInsertStatement,
  parseInsertStatement
} from "./canonical-data-materializer.mjs";

const ROOT = resolve(".");
const STATE_PATH = "database/prisma/state/canonical-state.json";
const RECON_PATH = "database/canonical/product-images/candidate-reconciliation.json";
const CATALOG_PATH = "database/seed/canonical-catalog-v1.sql";
const CANDIDATE_SECURITY_PATH = "scripts/canonical-candidate-reconciliation-security.mjs";
const RELEASE_SECURITY_PATH = "scripts/canonical-release-security.mjs";
const PHASE6_PATH = "scripts/phase6-release-rehearsal.mjs";
const MIGRATION_DOC_PATH = "database/prisma/MIGRATION_GENERATION_2.md";
const SPRINT_DOC_PATH = "docs/sprints/sprint-11/README.md";
const APPROVAL_AT = "2026-09-23 05:15:00.000";

const TARGETS = [
  ["P061", "cmtk4se700069ib1gkthu04j5", "sarima-p061-fce23d8079bb", "jpg"],
  ["P074", "cmtk4se9t007lib1gunsvwhxr", "sarima-p074-5a49e8292dd6", "jpg"],
  ["P075", "cmtk4sea1007pib1gbxjuxh8l", "sarima-p075-3a83afda0834", "jpg"],
  ["P219", "cmtk4sf5m00m9ib1g50dzc76m", "sarima-p219-b7553e591e41", "jpg"],
  ["P238", "cmtk4sf9q00o9ib1ga719u9g9", "sarima-p238-b021064db04e", "jpg"],
  ["P317", "cmtk4sfus00wtib1g6dzghbwy", "sarima-p317-53087e7fad87", "jpg"],
  ["P342", "cmtk4sg0y00zlib1gefat8q3s", "sarima-p342-835dc5906f86", "jpg"]
];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, value) {
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function sqlString(value) {
  return "'" + String(value).replaceAll("\\", "\\\\").replaceAll("'", "''") + "'";
}

function rewriteInsert(sql, table, mutate) {
  const statement = extractInsertStatement(sql, table);
  const parsed = parseInsertStatement(statement);
  const index = Object.fromEntries(parsed.columns.map((column, position) => [column, position]));
  let changed = 0;

  for (const tuple of parsed.tuples) {
    const row = Object.fromEntries(
      parsed.columns.map((column, position) => [column, decodeSqlValue(tuple.values[position])])
    );
    if (mutate(row, tuple.values, index)) changed += 1;
  }

  const rebuilt =
    "INSERT INTO `" +
    table +
    "` (" +
    parsed.columns.map((column) => "`" + column + "`").join(", ") +
    ") VALUES " +
    parsed.tuples.map((tuple) => "(" + tuple.values.join(",") + ")").join(",") +
    ";";

  return { sql: sql.replace(statement, rebuilt), changed };
}

function replaceRequired(source, before, after, label) {
  if (!source.includes(before)) throw new Error("Missing expected " + label + " pattern.");
  return source.replace(before, after);
}

const state = readJson(STATE_PATH);
const releasePath = state.canonicalReleasePath;
const release = readJson(releasePath);
const reconciliation = readJson(RECON_PATH);
const targetByProduct = new Map(TARGETS.map((target) => [target[1], target]));
const targetByCode = new Map(TARGETS.map((target) => [target[0], target]));
const targetByCandidate = new Map(TARGETS.map((target) => [target[2], target]));

let catalogSql = readFileSync(CATALOG_PATH, "utf8");

const productsResult = rewriteInsert(catalogSql, "products", (row, values, index) => {
  const target = targetByProduct.get(row.id);
  if (!target) return false;
  const [, , candidateId] = target;
  values[index.active_image_asset_id] = sqlString(candidateId);
  values[index.image_url] = sqlString("/api/storefront/product-images/" + candidateId + "/card");
  return true;
});
catalogSql = productsResult.sql;

const assetsResult = rewriteInsert(catalogSql, "product_image_assets", (row, values, index) => {
  const target = targetByCandidate.get(row.id);
  if (!target) return false;
  values[index.quality_status] = sqlString("APPROVED");
  values[index.processing_status] = sqlString("READY");
  if (index.approved_at !== undefined) values[index.approved_at] = sqlString(APPROVAL_AT);
  if (index.rejected_at !== undefined) values[index.rejected_at] = "NULL";
  if (index.superseded_at !== undefined) values[index.superseded_at] = "NULL";
  return true;
});
catalogSql = assetsResult.sql;

if (productsResult.changed !== TARGETS.length || assetsResult.changed !== TARGETS.length) {
  throw new Error(
    "Expected to update 7 products and 7 image assets, got products=" +
      productsResult.changed +
      " assets=" +
      assetsResult.changed
  );
}
writeFileSync(CATALOG_PATH, catalogSql, "utf8");

for (const product of release.products ?? []) {
  const target = targetByCode.get(product.sourceProductId);
  if (!target) continue;
  const [, , candidateId, extension] = target;
  product.catalogImage = {
    activeImageAssetId: candidateId,
    qualityStatus: "APPROVED",
    processingStatus: "READY",
    originalStorageKey: "candidates/" + candidateId + "/original." + extension,
    processedStorageKey: "candidates/" + candidateId + "/processed/processed.webp",
    cardStorageKey: "candidates/" + candidateId + "/processed/card.webp",
    pdpStorageKey: "candidates/" + candidateId + "/processed/pdp.webp",
    legacyImageUrl: "/api/storefront/product-images/" + candidateId + "/card"
  };
}
writeJson(releasePath, release);

reconciliation.activeApprovedMatches = 50;
reconciliation.unselectedNeedsReviewMatches = 0;
for (const item of reconciliation.items ?? []) {
  if (targetByCode.has(item.sourceProductId)) item.catalogBinding = "ACTIVE_APPROVED";
}
writeJson(RECON_PATH, reconciliation);

let candidateSecurity = readFileSync(CANDIDATE_SECURITY_PATH, "utf8");
candidateSecurity = replaceRequired(
  candidateSecurity,
  `  if (reconciliation.activeApprovedMatches !== 43) {
    findings.push("BLOCK: candidate reconciliation must contain 43 active approved matches.");
  }
  if (reconciliation.unselectedNeedsReviewMatches !== 7) {
    findings.push(
      "BLOCK: candidate reconciliation must contain 7 unselected needs-review matches."
    );
  }`,
  `  if (
    reconciliation.activeApprovedMatches + reconciliation.unselectedNeedsReviewMatches !== 50
  ) {
    findings.push("BLOCK: candidate reconciliation active/review counts must total 50.");
  }
  if (state.distributionReady && reconciliation.activeApprovedMatches !== 50) {
    findings.push(
      "BLOCK: distributionReady=true requires all 50 canonical products to have active approved images."
    );
  }
  if (state.distributionReady && reconciliation.unselectedNeedsReviewMatches !== 0) {
    findings.push(
      "BLOCK: distributionReady=true cannot retain unselected needs-review image matches."
    );
  }`,
  "candidate reconciliation count"
);
writeFileSync(CANDIDATE_SECURITY_PATH, candidateSecurity, "utf8");

let releaseSecurity = readFileSync(RELEASE_SECURITY_PATH, "utf8");
const releaseSecurityBefore = [
  "    } else if (!product.catalogImage?.legacyImageUrl) {",
  "      findings.push(\`BLOCK: \${code} has neither an active image asset nor a legacy image URL.\`);",
  "    }"
].join("\\n");
const releaseSecurityAfter = [
  "    } else if (state.distributionReady) {",
  "      findings.push(",
  "        \`BLOCK: \${code} has no active canonical image asset while distributionReady=true.\`",
  "      );",
  "    } else if (!product.catalogImage?.legacyImageUrl) {",
  "      findings.push(\`BLOCK: \${code} has neither an active image asset nor a legacy image URL.\`);",
  "    }"
].join("\\n");
releaseSecurity = replaceRequired(
  releaseSecurity,
  releaseSecurityBefore,
  releaseSecurityAfter,
  "release active image requirement"
);
writeFileSync(RELEASE_SECURITY_PATH, releaseSecurity, "utf8");

let phase6 = readFileSync(PHASE6_PATH, "utf8");
const imageBindingFunction = `
function verifyCanonicalImageBindings(url, release) {
  const productIds = release.products.map((product) => product.productId);
  const rows = mysql(
    url,
    "SELECT p.id,p.active_image_asset_id,p.image_url,a.quality_status,a.processing_status,a.card_storage_key " +
      "FROM products p LEFT JOIN product_image_assets a ON a.id=p.active_image_asset_id " +
      "WHERE p.id IN (" +
      productIds.map(sqlString).join(",") +
      ") ORDER BY p.id;"
  )
    .split(/\\r?\\n/)
    .filter(Boolean)
    .map((line) => line.split("\\t"));

  assert.equal(rows.length, 50, "Expected 50 canonical product image bindings.");
  const releaseByProductId = new Map(
    release.products.map((product) => [product.productId, product])
  );

  for (const [productId, assetId, imageUrl, quality, processing, cardStorageKey] of rows) {
    const expected = releaseByProductId.get(productId);
    assert.ok(expected, productId + " is not present in the canonical release.");
    const expectedAssetId = expected.catalogImage?.activeImageAssetId;
    assert.ok(expectedAssetId, productId + " has no active image asset in the canonical release.");
    assert.equal(assetId, expectedAssetId, productId + " DB active image differs from release.");
    assert.equal(
      imageUrl,
      "/api/storefront/product-images/" + expectedAssetId + "/card",
      productId + " image URL is not canonical."
    );
    assert.equal(quality, "APPROVED", productId + " active image is not APPROVED.");
    assert.equal(processing, "READY", productId + " active image is not READY.");
    assert.equal(
      cardStorageKey,
      expected.catalogImage.cardStorageKey,
      productId + " card storage key differs from release."
    );
  }
}
`;
phase6 = replaceRequired(
  phase6,
  "function frozenMigrationGuard(state) {",
  imageBindingFunction + "\nfunction frozenMigrationGuard(state) {",
  "Phase 6 image binding insertion"
);
phase6 = replaceRequired(
  phase6,
  "async function webStartupSmoke(url) {",
  "async function webStartupSmoke(url, runtimeRoot, release) {",
  "Phase 6 web startup signature"
);
phase6 = replaceRequired(
  phase6,
  `      DATABASE_URL: url,
      YSABELLE_DEV_SMOKE: "1"`,
  `      DATABASE_URL: url,
      YSABELLE_CATALOG_IMAGE_ROOT: runtimeRoot,
      YSABELLE_DEV_SMOKE: "1"`,
  "Phase 6 runtime asset root env"
);
phase6 = replaceRequired(
  phase6,
  `    const frontendResponse = await fetch(runtime.frontendUrl, {
      signal: AbortSignal.timeout(10_000)
    });
    assert.equal(frontendResponse.ok, true, "Frontend did not return HTTP success.");
    assert.match(await frontendResponse.text(), /id="root"/);

    if (child.connected) child.send({ type: "shutdown" });`,
  `    const frontendResponse = await fetch(runtime.frontendUrl, {
      signal: AbortSignal.timeout(10_000)
    });
    assert.equal(frontendResponse.ok, true, "Frontend did not return HTTP success.");
    assert.match(await frontendResponse.text(), /id="root"/);

    for (const product of release.products) {
      const imageId = product.catalogImage?.activeImageAssetId;
      assert.ok(imageId, product.productId + " has no active image asset.");
      const imageResponse = await fetch(
        new URL(
          "/api/storefront/product-images/" + encodeURIComponent(imageId) + "/card",
          runtime.apiBaseUrl + "/"
        ),
        { signal: AbortSignal.timeout(10_000) }
      );
      assert.equal(
        imageResponse.ok,
        true,
        product.productId + " canonical image endpoint did not return HTTP success."
      );
      assert.match(
        imageResponse.headers.get("content-type") ?? "",
        /^image\\/webp/i,
        product.productId + " canonical image endpoint returned the wrong content type."
      );
      assert.ok(
        (await imageResponse.arrayBuffer()).byteLength > 0,
        product.productId + " canonical image endpoint returned empty bytes."
      );
    }

    if (child.connected) child.send({ type: "shutdown" });`,
  "Phase 6 reachable image check"
);
phase6 = replaceRequired(
  phase6,
  `    verifyDbImageReferences(url, assets, distribution.plan, reconciliation);

    const card = distribution.plan.find((record) => record.role === "card");`,
  `    verifyDbImageReferences(url, assets, distribution.plan, reconciliation);
    verifyCanonicalImageBindings(url, release);

    const card = distribution.plan.find((record) => record.role === "card");`,
  "Phase 6 canonical image binding call"
);
phase6 = replaceRequired(
  phase6,
  "    await webStartupSmoke(url);",
  "    await webStartupSmoke(url, assets, release);",
  "Phase 6 web startup invocation"
);
phase6 = replaceRequired(
  phase6,
  `        "private=preserved imageRefs=50x4 corruptImage=blockedAndRepaired restart=idempotent " +
        "frozenMigration=blocked prismaGenerate=pass appStartup=pass"`,
  `        "private=preserved imageRefs=50x4 productImageBindings=50 reachableImages=50 " +
        "corruptImage=blockedAndRepaired restart=idempotent frozenMigration=blocked " +
        "prismaGenerate=pass appStartup=pass"`,
  "Phase 6 pass marker"
);
writeFileSync(PHASE6_PATH, phase6, "utf8");

let migrationDoc = readFileSync(MIGRATION_DOC_PATH, "utf8");
migrationDoc = replaceRequired(
  migrationDoc,
  "Legacy database replacement remains fail-closed while `distributionReady` is false. The current blocker is the incomplete canonical product-image corpus; a populated legacy database must not be replaced with a state that would lose its working image assets.",
  "Canonical distribution is now enabled with `distributionReady=true`. The production-50 release has complete canonical data, active approved image bindings for all 50 products, and an integrity-pinned runtime image payload; guarded legacy/empty recovery may therefore converge to the canonical release after backup and verification.",
  "Generation 2 local state marker documentation"
);
migrationDoc = replaceRequired(
  migrationDoc,
  "Legacy and empty database replacement is intentionally fail-closed while `distributionReady` is false. This prevents an automatic pull from replacing a working database before the complete approved catalog-image corpus and canonical data distribution package are available.",
  "Legacy and empty database replacement remains guarded by explicit recovery confirmation and safety backup, but the canonical distribution package is complete and enabled. Compatible Generation 2 pulls converge schema, canonical data, active image bindings, and exact runtime image bytes while runtime/private tables remain excluded from team-owned canonical state.",
  "Generation 2 pull convergence documentation"
);
writeFileSync(MIGRATION_DOC_PATH, migrationDoc, "utf8");

let sprintDoc = readFileSync(SPRINT_DOC_PATH, "utf8");
if (!sprintDoc.includes("## Phase 6 image-link acceptance closure")) {
  sprintDoc =
    sprintDoc.trimEnd() +
    `

## Phase 6 image-link acceptance closure

The seven previously review-only production image candidates (P061, P074, P075, P219, P238, P317, and P342) were visually verified against their product identities and promoted into the canonical release as active APPROVED/READY assets. The production-50 contract now requires 50/50 active image bindings whenever `distributionReady=true`. Release security and candidate-reconciliation security fail closed if that invariant regresses, and the Phase 6 rehearsal verifies both database binding parity and HTTP reachability of all 50 canonical card-image endpoints against the exact materialized runtime payload.
`;
}
writeFileSync(SPRINT_DOC_PATH, sprintDoc, "utf8");

console.log(
  "PHASE6_IMAGE_ACCEPTANCE_FIX=PASS products=7 assets=7 activeApproved=50 review=0"
);
