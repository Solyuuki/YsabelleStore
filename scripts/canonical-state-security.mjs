#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(".");
const STATE_PATH = join(ROOT, "database", "prisma", "state", "canonical-state.json");

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export function gitBlobOid(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`, "utf8");
  return createHash("sha1").update(header).update(buffer).digest("hex");
}

function walkFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function normalize(path) {
  return path.split(sep).join("/");
}

export function inspectCanonicalState(root = ROOT) {
  const findings = [];
  const statePath = join(root, "database", "prisma", "state", "canonical-state.json");
  if (!existsSync(statePath)) return ["BLOCK: canonical-state.json is missing."];

  const state = JSON.parse(readFileSync(statePath, "utf8"));
  for (const key of ["schemaVersion", "catalogVersion", "assetVersion"]) {
    if (!Number.isInteger(state[key]) || state[key] < 1) {
      findings.push(`BLOCK: ${key} must be a positive integer.`);
    }
  }

  const schemaPath = join(root, state.schemaPath ?? "");
  if (!existsSync(schemaPath)) {
    findings.push("BLOCK: canonical schema path is missing.");
  } else {
    const actual = sha256(readFileSync(schemaPath));
    if (actual !== state.schemaSha256) {
      findings.push("BLOCK: schema.prisma differs from canonical-state.json.");
    }
  }

  const catalogPath = join(root, state.canonicalCatalogPath ?? "");
  if (!existsSync(catalogPath)) {
    findings.push("BLOCK: canonical catalog source is missing.");
  } else {
    const actual = sha256(readFileSync(catalogPath));
    if (actual !== state.canonicalCatalogSha256) {
      findings.push("BLOCK: canonical catalog differs from canonical-state.json.");
    }
  }

  const manifestPath = join(root, state.productAssetManifestPath ?? "");
  if (!existsSync(manifestPath)) {
    findings.push("BLOCK: product asset manifest is missing.");
    return findings;
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.assetVersion !== state.assetVersion) {
    findings.push("BLOCK: product asset manifest version differs from canonical state.");
  }

  const rootPath = join(root, manifest.root ?? "");
  if (!existsSync(rootPath)) {
    findings.push("BLOCK: canonical product asset root is missing.");
    return findings;
  }

  const expected = new Map();
  for (const asset of manifest.trackedAssets ?? []) {
    if (!asset.path || !asset.gitBlobOid) {
      findings.push("BLOCK: product asset manifest contains an incomplete entry.");
      continue;
    }
    if (expected.has(asset.path)) {
      findings.push(`BLOCK: duplicate product asset manifest entry: ${asset.path}.`);
      continue;
    }
    expected.set(asset.path, asset.gitBlobOid);

    const absolute = join(root, asset.path);
    const withinRoot = normalize(relative(rootPath, absolute));
    if (withinRoot.startsWith("../") || withinRoot === "..") {
      findings.push(`BLOCK: product asset escapes canonical root: ${asset.path}.`);
      continue;
    }
    if (!existsSync(absolute)) {
      findings.push(`BLOCK: canonical product asset is missing: ${asset.path}.`);
      continue;
    }
    const actual = gitBlobOid(readFileSync(absolute));
    if (actual !== asset.gitBlobOid) {
      findings.push(`BLOCK: canonical product asset content changed without manifest update: ${asset.path}.`);
    }
  }

  const binaryPattern = /\.(?:avif|jpe?g|png|webp)$/i;
  for (const absolute of walkFiles(rootPath)) {
    if (!binaryPattern.test(absolute)) continue;
    const path = normalize(relative(root, absolute));
    if (!expected.has(path)) {
      findings.push(`BLOCK: unmanifested canonical product asset: ${path}.`);
    }
  }

  return findings;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const findings = inspectCanonicalState();
  if (findings.length > 0) {
    for (const finding of findings) console.error(finding);
    console.error(`CANONICAL_STATE_SECURITY=BLOCKED (${findings.length} findings)`);
    process.exitCode = 1;
  } else {
    const state = JSON.parse(readFileSync(STATE_PATH, "utf8"));
    console.log(
      `CANONICAL_STATE_SECURITY=PASS schema=${state.schemaVersion} catalog=${state.catalogVersion} assets=${state.assetVersion}`
    );
  }
}
