#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(".");
const REQUIRED_RUNTIME_EXCLUSIONS = new Set([
  "users",
  "trusted_devices",
  "customer_accounts",
  "customer_sessions",
  "customer_cart_items",
  "customer_orders",
  "customer_order_items",
  "sales",
  "sale_items",
  "inventory",
  "inventory_batches",
  "inventory_movements"
]);

export function gitBlobOid(buffer) {
  const bytes = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const header = Buffer.from(`blob ${bytes.length}\0`, "utf8");
  return createHash("sha1").update(header).update(bytes).digest("hex");
}

export function expectedImageAssetId(productCode, driveFileId) {
  const suffix = createHash("sha256").update(driveFileId, "utf8").digest("hex").slice(0, 12);
  return `sarima-${productCode.toLowerCase()}-${suffix}`;
}

function normalize(path) {
  return path.split(sep).join("/");
}

function listFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(directory, entry.name));
}

export function inspectReleaseContract({ state, release, root = ROOT }) {
  const findings = [];

  if (release.formatVersion !== 1)
    findings.push("BLOCK: canonical release formatVersion must be 1.");
  if (release.releaseId !== state.releaseId)
    findings.push("BLOCK: canonical releaseId differs from canonical state.");
  for (const key of ["migrationEpoch", "catalogVersion", "assetVersion"]) {
    if (release[key] !== state[key])
      findings.push(`BLOCK: canonical release ${key} differs from canonical state.`);
  }
  if (release.canonicalScope !== "PRODUCTION_VERIFIED_50")
    findings.push("BLOCK: canonical release scope is not PRODUCTION_VERIFIED_50.");
  if (release.expectedProducts !== 50 || release.products?.length !== 50)
    findings.push("BLOCK: canonical release must contain exactly 50 production products.");
  if (release.inventoryPolicy !== "PRESERVE_RUNTIME_STATE")
    findings.push("BLOCK: inventory must remain runtime-owned during canonical catalog sync.");
  if (release.productImagePolicy !== "GIT_PINNED_SOURCE_BYTES")
    findings.push("BLOCK: canonical product images must use Git-pinned source bytes.");

  const excluded = new Set(release.excludedRuntimeTables ?? []);
  for (const table of REQUIRED_RUNTIME_EXCLUSIONS) {
    if (!excluded.has(table))
      findings.push(`BLOCK: runtime/private table is not excluded from canonical sync: ${table}.`);
  }
  for (const table of release.canonicalTables ?? []) {
    if (excluded.has(table))
      findings.push(`BLOCK: table cannot be both canonical and runtime-excluded: ${table}.`);
  }

  const seen = {
    codes: new Set(),
    ids: new Set(),
    skus: new Set(),
    barcodes: new Set(),
    paths: new Set(),
    driveIds: new Set()
  };
  const expectedFiles = new Set();
  const sourceRoot = join(root, state.canonicalProductImageRoot ?? "");

  for (const product of release.products ?? []) {
    const code = product.sourceProductId;
    if (!/^P\d{3}$/.test(code ?? ""))
      findings.push(`BLOCK: invalid source product code: ${String(code)}.`);
    if (product.sku !== `SARIMA-${code}`)
      findings.push(`BLOCK: canonical SKU does not match source identity for ${code}.`);

    for (const [label, value, set] of [
      ["source code", code, seen.codes],
      ["product id", product.productId, seen.ids],
      ["SKU", product.sku, seen.skus],
      ["manufacturer barcode", product.manufacturerBarcode, seen.barcodes],
      ["source image path", product.sourceImage?.path, seen.paths],
      ["Drive file id", product.sourceImage?.driveFileId, seen.driveIds]
    ]) {
      if (!value) {
        findings.push(`BLOCK: ${code ?? "unknown"} is missing ${label}.`);
      } else if (set.has(value)) {
        findings.push(`BLOCK: duplicate canonical ${label}: ${value}.`);
      } else {
        set.add(value);
      }
    }

    if (!product.description?.trim())
      findings.push(`BLOCK: ${code} is missing its approved description.`);

    const source = product.sourceImage;
    if (!source?.path) continue;
    const absolute = join(root, source.path);
    const withinRoot = normalize(relative(sourceRoot, absolute));
    if (withinRoot === ".." || withinRoot.startsWith("../")) {
      findings.push(`BLOCK: ${code} source image escapes canonical image root.`);
      continue;
    }
    expectedFiles.add(normalize(absolute));
    if (!existsSync(absolute)) {
      findings.push(`BLOCK: canonical source image is missing for ${code}: ${source.path}.`);
      continue;
    }
    const bytes = readFileSync(absolute);
    if (bytes.length !== source.sizeBytes)
      findings.push(`BLOCK: canonical source image size changed for ${code}.`);
    if (gitBlobOid(bytes) !== source.gitBlobOid)
      findings.push(`BLOCK: canonical source image bytes changed for ${code}.`);

    const activeId = product.catalogImage?.activeImageAssetId;
    if (activeId) {
      const expectedId = expectedImageAssetId(code, source.driveFileId);
      if (activeId !== expectedId)
        findings.push(
          `BLOCK: ${code} active image asset does not match its pinned Drive identity.`
        );
      if (
        product.catalogImage.qualityStatus !== "APPROVED" ||
        product.catalogImage.processingStatus !== "READY"
      )
        findings.push(`BLOCK: ${code} active image asset is not APPROVED/READY.`);
    } else if (!product.catalogImage?.legacyImageUrl) {
      findings.push(`BLOCK: ${code} has neither an active image asset nor a legacy image URL.`);
    }
  }

  for (const file of listFiles(sourceRoot)) {
    const extension = extname(file).toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".webp", ".avif"].includes(extension)) continue;
    const normalized = normalize(file);
    if (!expectedFiles.has(normalized))
      findings.push(
        `BLOCK: unmanifested canonical product image source: ${normalize(relative(root, file))}.`
      );
  }

  if (expectedFiles.size !== 50)
    findings.push(`BLOCK: expected 50 canonical source image files, found ${expectedFiles.size}.`);

  return findings;
}

export function inspectRepository(root = ROOT) {
  const statePath = join(root, "database", "prisma", "state", "canonical-state.json");
  if (!existsSync(statePath)) return ["BLOCK: canonical-state.json is missing."];
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  const releasePath = join(root, state.canonicalReleasePath ?? "");
  if (!existsSync(releasePath)) return ["BLOCK: canonical release manifest is missing."];

  const releaseBytes = readFileSync(releasePath);
  if (gitBlobOid(releaseBytes) !== state.canonicalReleaseGitBlobOid)
    return ["BLOCK: canonical release manifest bytes differ from canonical-state.json."];

  const release = JSON.parse(releaseBytes.toString("utf8"));
  return inspectReleaseContract({ state, release, root });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const findings = inspectRepository();
  if (findings.length) {
    for (const finding of findings) console.error(finding);
    console.error(`CANONICAL_RELEASE_SECURITY=BLOCKED (${findings.length} findings)`);
    process.exitCode = 1;
  } else {
    console.log("CANONICAL_RELEASE_SECURITY=PASS products=50 sources=50");
  }
}
