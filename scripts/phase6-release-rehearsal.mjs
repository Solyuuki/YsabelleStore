#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  loadAssetDistribution,
  verifyMaterializedAssets
} from "./canonical-asset-materializer.mjs";
import { parseMysqlDatabaseUrl } from "./canonical-database-recovery.mjs";
import { evaluatePushPolicy } from "./canonical-push-guard.mjs";
import { resolveDevelopmentRuntime } from "./lib/runtime-config.mjs";
import { resolveNpmInvocation } from "./lib/npm-invocation.mjs";

const ROOT = resolve(".");
const PHASE4 = join(ROOT, "scripts", "phase4-convergence-rehearsal.mjs");
const PHASE5 = join(ROOT, "scripts", "phase5-publication-rehearsal.mjs");
const PULL = join(ROOT, "scripts", "canonical-pull-sync.mjs");
const PRISMA = join(ROOT, "node_modules", "prisma", "build", "index.js");
const SCHEMA = join(ROOT, "database", "prisma", "schema.prisma");
const STATE_PATH = join(ROOT, "database", "prisma", "state", "canonical-state.json");
const CHECKSUM_PATH = join(ROOT, "database", "prisma", "state", "migration-checksums.json");
const RECON_PATH = join(
  ROOT,
  "database",
  "canonical",
  "product-images",
  "candidate-reconciliation.json"
);
const READY_MARKER = "Press Ctrl+C once to stop every process in this development stack.";
const SENTINEL_ID = "phase6-runtime-sentinel";

function fail(message) {
  throw new Error("PHASE6_RELEASE_REHEARSAL_BLOCKED: " + message);
}

function run(
  command,
  args,
  { capture = false, allowFailure = false, env = process.env, shell = false } = {}
) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    env,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
    shell
  });
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    throw new Error(
      command +
        " failed: " +
        (result.stderr || result.stdout || "exit=" + String(result.status)).trim()
    );
  }
  return result;
}

function mysql(url, sql) {
  const connection = parseMysqlDatabaseUrl(url);
  const args = [
    "--host",
    connection.host,
    "--port",
    connection.port,
    "--user",
    connection.user,
    "--batch",
    "--skip-column-names"
  ];
  if (connection.database) args.push(connection.database);
  args.push("--execute", sql);
  return run(process.env.MYSQL_EXECUTABLE?.trim() || "mysql", args, {
    capture: true,
    env: { ...process.env, MYSQL_PWD: connection.password }
  }).stdout.trim();
}

function adminUrl(url) {
  const parsed = new URL(url);
  parsed.pathname = "/mysql";
  return parsed.toString();
}

function recreate(url) {
  const connection = parseMysqlDatabaseUrl(url);
  if (!/^[A-Za-z0-9_]+$/.test(connection.database)) fail("unsafe database name");
  mysql(
    adminUrl(url),
    "DROP DATABASE IF EXISTS `" +
      connection.database +
      "`; CREATE DATABASE `" +
      connection.database +
      "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
  );
}

function deploy(url) {
  run(process.execPath, [PRISMA, "migrate", "deploy", "--schema", SCHEMA], {
    env: { ...process.env, DATABASE_URL: url }
  });
}

function pull(url, assets, backups) {
  return run(process.execPath, [PULL, "--force", "--confirm-recovery"], {
    capture: true,
    env: {
      ...process.env,
      DATABASE_URL: url,
      YSABELLE_CATALOG_IMAGE_ROOT: assets,
      YSABELLE_CANONICAL_BACKUP_ROOT: backups,
      YSABELLE_CANONICAL_RECOVERY_CONFIRM: "1"
    }
  });
}

function sqlString(value) {
  return "'" + String(value).replaceAll("'", "''") + "'";
}

function marker(url) {
  return mysql(
    url,
    "SELECT CONCAT(migration_epoch,'|',schema_version,'|',catalog_version,'|',asset_version,'|',release_id) FROM system_canonical_state WHERE id=1;"
  );
}

function migrationCount(url) {
  return Number(
    mysql(
      url,
      "SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;"
    )
  );
}

function countRuntimeFiles(root) {
  let count = 0;
  const candidateRoot = join(root, "candidates");
  if (!existsSync(candidateRoot)) return 0;
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) count += 1;
    }
  };
  walk(candidateRoot);
  return count;
}

function verifyDbImageReferences(url, runtimeRoot, plan, reconciliation) {
  const ids = reconciliation.items.map((item) => item.candidateId);
  const rows = mysql(
    url,
    "SELECT id,original_storage_key,processed_storage_key,card_storage_key,pdp_storage_key " +
      "FROM product_image_assets WHERE id IN (" +
      ids.map(sqlString).join(",") +
      ") ORDER BY id;"
  )
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split("\t"));

  assert.equal(rows.length, 50, "Expected 50 canonical product-image rows.");
  const byKey = new Map(plan.map((record) => [record.candidateId + ":" + record.role, record]));
  for (const [id, original, processed, card, pdp] of rows) {
    for (const [role, storageKey] of [
      ["original", original],
      ["processed", processed],
      ["card", card],
      ["pdp", pdp]
    ]) {
      assert.ok(storageKey && storageKey !== "NULL", id + " missing " + role + " storage key.");
      const record = byKey.get(id + ":" + role);
      assert.ok(record, id + " missing " + role + " distribution record.");
      assert.equal(
        storageKey.replaceAll("\\", "/"),
        record.relativePath.replaceAll("\\", "/"),
        id + " " + role + " storage key diverges from distribution."
      );
      assert.ok(existsSync(join(runtimeRoot, storageKey)), id + " " + role + " file is missing.");
    }
  }
}

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
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split("\t"));

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

function frozenMigrationGuard(state) {
  const checksums = JSON.parse(readFileSync(CHECKSUM_PATH, "utf8"));
  const first = Object.keys(checksums.migrations || {}).sort()[0];
  assert.ok(first, "Expected at least one frozen Generation 2 migration.");
  const edited = structuredClone(checksums);
  edited.migrations[first] = "edited";
  const findings = evaluatePushPolicy({
    changed: ["database/prisma/migrations/" + first + "/migration.sql"],
    localState: { ...state, schemaVersion: state.schemaVersion + 1 },
    remoteState: state,
    localChecksums: edited,
    remoteChecksums: checksums
  });
  assert.ok(
    findings.some((item) => item.includes("frozen remote migration")),
    "Edited frozen migration was not blocked by publication policy."
  );
}

function withTimeout(promise, milliseconds, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), milliseconds))
  ]);
}

async function webStartupSmoke(url, runtimeRoot, release) {
  const runtime = resolveDevelopmentRuntime();
  const child = spawn(process.execPath, ["scripts/dev.mjs", "--web-only"], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: "development",
      DATABASE_URL: url,
      CATALOG_IMAGE_STORAGE_ROOT: runtimeRoot,
      YSABELLE_CATALOG_IMAGE_ROOT: runtimeRoot,
      YSABELLE_DEV_SMOKE: "1"
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
    windowsHide: true
  });
  let output = "";
  let ready = false;
  const exit = new Promise((resolveExit) => {
    child.once("exit", (code, signal) => resolveExit({ code, signal }));
  });
  const readiness = new Promise((resolveReady, rejectReady) => {
    const timeout = setTimeout(() => {
      rejectReady(new Error("web startup did not become ready within 90 seconds.\n" + output));
    }, 90_000);
    const inspect = (chunk) => {
      output = (output + chunk.toString()).slice(-65_536);
      if (!ready && output.includes(READY_MARKER)) {
        ready = true;
        clearTimeout(timeout);
        resolveReady();
      }
    };
    child.stdout.on("data", inspect);
    child.stderr.on("data", inspect);
    child.once("exit", (code, signal) => {
      if (ready) return;
      clearTimeout(timeout);
      rejectReady(
        new Error(
          "web startup exited before readiness code=" +
            String(code) +
            " signal=" +
            String(signal) +
            "\n" +
            output
        )
      );
    });
  });

  try {
    await readiness;
    const healthResponse = await fetch(new URL("/api/health", runtime.apiBaseUrl + "/"), {
      signal: AbortSignal.timeout(10_000)
    });
    assert.equal(healthResponse.ok, true, "Backend health endpoint did not return HTTP success.");
    const health = await healthResponse.json();
    assert.equal(health?.data?.service, "ysabellestore-backend");
    assert.equal(health?.data?.checks?.database, "connected");

    const frontendResponse = await fetch(runtime.frontendUrl, {
      signal: AbortSignal.timeout(10_000)
    });
    assert.equal(frontendResponse.ok, true, "Frontend did not return HTTP success.");
    assert.match(await frontendResponse.text(), /id="root"/);

    const loginResponse = await fetch(new URL("/api/auth/login", runtime.apiBaseUrl + "/"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "staff@ysabellestore.local",
        password: "StaffPass#2026"
      }),
      signal: AbortSignal.timeout(10_000)
    });
    assert.equal(loginResponse.status, 200, "Development staff account could not sign in.");
    const loginPayload = await loginResponse.json();
    assert.equal(
      loginPayload?.data?.user?.email,
      "staff@ysabellestore.local",
      "Development staff login returned the wrong user."
    );

    const inventoryResponse = await fetch(
      new URL("/api/inventory?page=1&pageSize=100&stockStatus=ALL", runtime.apiBaseUrl + "/"),
      {
        headers: { Authorization: "Bearer " + loginPayload.data.token },
        signal: AbortSignal.timeout(10_000)
      }
    );
    assert.equal(inventoryResponse.ok, true, "Team inventory parity endpoint failed.");
    const inventoryPayload = await inventoryResponse.json();
    assert.equal(inventoryPayload?.meta?.totalItems, 50, "Expected 50 team inventory rows.");
    assert.equal(inventoryPayload?.data?.length, 50, "Expected 50 team inventory records.");
    assert.equal(
      inventoryPayload.data.every((item) => Number(item.currentQuantity) > 0),
      true,
      "Expected every team inventory product to have positive stock."
    );

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
        /^image\/webp/i,
        product.productId + " canonical image endpoint returned the wrong content type."
      );
      assert.ok(
        (await imageResponse.arrayBuffer()).byteLength > 0,
        product.productId + " canonical image endpoint returned empty bytes."
      );
    }

    if (child.connected) child.send({ type: "shutdown" });
    const result = await withTimeout(exit, 20_000, "web startup smoke did not stop cleanly.");
    assert.equal(result.code, 0, "web startup smoke exited non-zero.");
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      if (child.connected) child.send({ type: "shutdown" });
      await Promise.race([exit, new Promise((resolveDelay) => setTimeout(resolveDelay, 5_000))]);
    }
    if (child.exitCode === null && child.signalCode === null) {
      try {
        process.kill(child.pid, "SIGTERM");
      } catch {
        // Process already exited.
      }
    }
  }
}

async function main() {
  if (process.env.PHASE6_REHEARSAL_ALLOW !== "1") {
    fail("PHASE6_REHEARSAL_ALLOW=1 required");
  }
  const url = process.env.DATABASE_URL;
  if (!url) fail("DATABASE_URL required");
  const connection = parseMysqlDatabaseUrl(url);
  if (!/(?:^|_)(?:ci|test|rehearsal)(?:_|$)/i.test(connection.database)) {
    fail("refusing non-disposable database " + connection.database);
  }
  if (!existsSync(PRISMA)) fail("Prisma CLI missing");

  const phase4 = run(process.execPath, [PHASE4], {
    capture: true,
    env: { ...process.env, PHASE4_REHEARSAL_ALLOW: "1", DATABASE_URL: url }
  });
  assert.match(phase4.stdout, /PHASE4_CONVERGENCE_REHEARSAL=PASS/);

  const phase5 = run(process.execPath, [PHASE5], { capture: true });
  assert.match(phase5.stdout, /PHASE5_PUBLICATION_REHEARSAL=PASS/);

  const state = JSON.parse(readFileSync(STATE_PATH, "utf8"));
  const release = JSON.parse(readFileSync(join(ROOT, state.canonicalReleasePath), "utf8"));
  const reconciliation = JSON.parse(readFileSync(RECON_PATH, "utf8"));
  const expectedMarker = [
    state.migrationEpoch,
    state.schemaVersion,
    state.catalogVersion,
    state.assetVersion,
    state.releaseId
  ].join("|");
  const tmp = mkdtempSync(join(tmpdir(), "ysabelle-phase6-"));
  const assets = join(tmp, "assets");
  const backups = join(tmp, "backups");

  try {
    recreate(url);
    deploy(url);
    const migrationCountBefore = migrationCount(url);
    const staleMarker = marker(url);
    const [staleEpoch, staleSchema, staleCatalog, staleAssets] = staleMarker
      .split("|")
      .slice(0, 4)
      .map(Number);
    assert.equal(
      staleEpoch,
      state.migrationEpoch,
      "Generation 2 baseline migration epoch differs from the current lineage."
    );
    assert.equal(
      staleSchema,
      state.schemaVersion,
      "Generation 2 baseline is not the expected same-schema state."
    );
    assert.ok(
      staleCatalog < state.catalogVersion,
      "Generation 2 baseline catalog is not older than the current canonical catalog."
    );
    assert.ok(
      staleAssets < state.assetVersion,
      "Generation 2 baseline assets are not older than the current canonical assets."
    );

    mysql(
      url,
      "INSERT INTO users(id,name,email,password_hash,role,status,created_at,updated_at) VALUES(" +
        sqlString(SENTINEL_ID) +
        ",'Phase 6 Sentinel','phase6-sentinel@invalid.local','not-a-login','STAFF','ACTIVE',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3));"
    );

    const converged = pull(url, assets, backups);
    assert.match(converged.stdout, /CANONICAL_PULL_SYNC=PASS/);
    assert.equal(marker(url), expectedMarker);
    assert.equal(
      migrationCount(url),
      migrationCountBefore,
      "Same-schema catalog/assets convergence unexpectedly changed migration history."
    );
    assert.equal(
      Number(mysql(url, "SELECT COUNT(*) FROM users WHERE id=" + sqlString(SENTINEL_ID) + ";")),
      1,
      "Runtime/private sentinel was not preserved."
    );
    assert.equal(countRuntimeFiles(assets), 200, "Expected exactly 200 canonical runtime files.");

    const firstProduct = release.products[0];
    assert.equal(
      mysql(url, "SELECT name FROM products WHERE id=" + sqlString(firstProduct.productId) + ";"),
      firstProduct.name,
      "Canonical product data did not converge."
    );

    const distribution = loadAssetDistribution(ROOT, assets);
    assert.deepEqual(verifyMaterializedAssets(distribution.plan), []);
    verifyDbImageReferences(url, assets, distribution.plan, reconciliation);
    verifyCanonicalImageBindings(url, release);

    const card = distribution.plan.find((record) => record.role === "card");
    assert.ok(card, "No card asset record available for corruption rehearsal.");
    const canonicalCard = readFileSync(card.targetPath);
    writeFileSync(card.targetPath, Buffer.from("phase6-corrupt-runtime-image"));
    assert.ok(
      verifyMaterializedAssets(distribution.plan).length > 0,
      "Corrupt runtime image was not rejected by hash verification."
    );

    const repaired = pull(url, assets, backups);
    assert.match(repaired.stdout, /CANONICAL_PULL_SYNC=PASS/);
    assert.deepEqual(verifyMaterializedAssets(distribution.plan), []);
    assert.deepEqual(
      readFileSync(card.targetPath),
      canonicalCard,
      "Restarted convergence did not restore the exact canonical image bytes."
    );

    const idempotent = pull(url, assets, backups);
    assert.match(
      idempotent.stdout,
      /assetsResult=NOOP/,
      "Restarted/current convergence is not idempotent."
    );

    frozenMigrationGuard(state);

    const prismaGenerate = resolveNpmInvocation(["run", "prisma:generate"]);
    run(prismaGenerate.command, prismaGenerate.args, {
      env: { ...process.env, DATABASE_URL: url },
      shell: prismaGenerate.shell
    });
    await webStartupSmoke(url, assets, release);

    assert.equal(
      existsSync(join(ROOT, ".github", "workflows", "phase5-workbench.yml")),
      false,
      "Temporary Phase 5 workbench must not remain in the branch."
    );

    console.log(
      "PHASE6_RELEASE_REHEARSAL=PASS phase4=pass phase5=pass staleCatalogAssets=converged " +
        "private=preserved teamAuth=pass teamStock=50 imageRefs=50x4 productImageBindings=50 " +
        "reachableImages=50 corruptImage=blockedAndRepaired restart=idempotent " +
        "frozenMigration=blocked prismaGenerate=pass appStartup=pass"
    );
  } finally {
    recreate(url);
    rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
