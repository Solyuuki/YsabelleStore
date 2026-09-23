#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

const ROOT = resolve(".");
const STATE = "database/prisma/state/canonical-state.json";
const RECON = "database/canonical/product-images/candidate-reconciliation.json";
const DIST = "database/canonical/product-images/runtime-distribution.manifest.json";
const ROLES = ["original", "processed", "card", "pdp"];
export const sha256 = (v) => createHash("sha256").update(v).digest("hex");
export function gitBlobOid(v) {
  const b = Buffer.isBuffer(v) ? v : Buffer.from(v);
  return createHash("sha1")
    .update(Buffer.from("blob " + b.length + "\0"))
    .update(b)
    .digest("hex");
}
export function parseDistributionRecords(text) {
  const lines = text.replace(/\r\n/g, "\n").trimEnd().split("\n");
  if (lines.shift() !== "candidateId\trole\tsizeBytes\tsha256\tgitBlobOid")
    throw new Error("Runtime distribution records header is invalid.");
  return lines.filter(Boolean).map((line) => {
    const [candidateId, role, sizeBytes, fileSha256, blob] = line.split("\t");
    if (!candidateId || !ROLES.includes(role)) throw new Error("Invalid runtime record: " + line);
    return {
      candidateId,
      role,
      sizeBytes: Number(sizeBytes),
      sha256: fileSha256,
      gitBlobOid: blob
    };
  });
}
function relativePath(item, role) {
  if (!/^[a-z0-9-]+$/.test(item.candidateId))
    throw new Error("Unsafe candidate id: " + item.candidateId);
  if (role === "original") {
    const ext = String(item.originalExtension || "").toLowerCase();
    if (!/^[a-z0-9]+$/.test(ext)) throw new Error("Unsafe extension: " + item.candidateId);
    return join("candidates", item.candidateId, "original." + ext);
  }
  return join(
    "candidates",
    item.candidateId,
    "processed",
    role === "processed" ? "processed.webp" : role + ".webp"
  );
}
export function buildAssetMaterializationPlan({
  release,
  reconciliation,
  recordsText,
  runtimeRoot,
  root = ROOT
}) {
  const products = new Map((release.products || []).map((p) => [p.sourceProductId, p]));
  const items = new Map((reconciliation.items || []).map((i) => [i.candidateId, i]));
  return parseDistributionRecords(recordsText).map((record) => {
    const item = items.get(record.candidateId),
      product = item && products.get(item.sourceProductId);
    if (!item || !product || !product.sourceImage || !product.sourceImage.path)
      throw new Error("Missing canonical source: " + record.candidateId);
    const rel = relativePath(item, record.role);
    return {
      ...record,
      sourcePath: join(root, product.sourceImage.path),
      relativePath: rel,
      targetPath: join(runtimeRoot, rel)
    };
  });
}
function verify(path, r) {
  if (!existsSync(path)) return "missing: " + path;
  const st = statSync(path);
  if (!st.isFile()) return "not-file: " + path;
  if (st.size !== r.sizeBytes) return "size: " + path;
  const b = readFileSync(path);
  if (sha256(b) !== r.sha256) return "sha256: " + path;
  if (gitBlobOid(b) !== r.gitBlobOid) return "git-blob: " + path;
  return null;
}
export function verifyMaterializedAssets(plan, rootOverride = null) {
  return plan
    .map((r) => verify(rootOverride ? join(rootOverride, r.relativePath) : r.targetPath, r))
    .filter(Boolean);
}
function group(plan) {
  const m = new Map();
  for (const r of plan) {
    const x = m.get(r.candidateId) || new Map();
    x.set(r.role, r);
    m.set(r.candidateId, x);
  }
  return m;
}
export function processedCardAliases(plan) {
  const s = new Set();
  for (const [id, r] of group(plan)) {
    const p = r.get("processed"),
      c = r.get("card");
    if (
      p &&
      c &&
      p.sizeBytes === c.sizeBytes &&
      p.sha256 === c.sha256 &&
      p.gitBlobOid === c.gitBlobOid
    )
      s.add(id);
  }
  return s;
}
function run(cmd, args, capture = false) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    env: process.env,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    windowsHide: true
  });
  if (r.error) throw r.error;
  if (r.status !== 0)
    throw new Error(
      cmd +
        " failed (" +
        (r.status === null ? "unknown" : r.status) +
        ")" +
        (capture ? ": " + (r.stderr || r.stdout || "").trim() : "")
    );
  return r;
}
export function pythonInvocationCandidates({
  environment = process.env,
  platform = process.platform
} = {}) {
  const explicit = environment.PYTHON_EXECUTABLE?.trim();
  if (explicit) return [{ command: explicit, prefix: [] }];
  if (platform === "win32") {
    return [
      { command: "py", prefix: ["-3"] },
      { command: "python", prefix: [] },
      { command: "python3", prefix: [] }
    ];
  }
  return [
    { command: "python3", prefix: [] },
    { command: "python", prefix: [] }
  ];
}
function pythonSpawn(invocation, args) {
  return spawnSync(invocation.command, [...invocation.prefix, ...args], {
    cwd: ROOT,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
}
function runPython(invocation, args) {
  return run(invocation.command, [...invocation.prefix, ...args]);
}
function resolvePython(distribution) {
  const expected = distribution.reconstruction && distribution.reconstruction.pillowVersion;
  const req = distribution.reconstruction && distribution.reconstruction.pythonRequirementsPath;
  if (!expected || !req) throw new Error("Missing pinned image reconstruction contract.");

  const attempts = [];
  for (const invocation of pythonInvocationCandidates()) {
    const label = [invocation.command, ...invocation.prefix].join(" ");
    const version = pythonSpawn(invocation, ["--version"]);
    if (version.error || version.status !== 0) {
      attempts.push(label + ": unavailable");
      continue;
    }

    const inspect = () => pythonSpawn(invocation, ["-c", "import PIL; print(PIL.__version__)"]);
    let pillow = inspect();
    if (pillow.status === 0 && pillow.stdout.trim() === expected) return invocation;

    try {
      runPython(invocation, ["-m", "pip", "install", "--disable-pip-version-check", "-r", req]);
    } catch {
      attempts.push(label + ": pip/Pillow setup failed");
      continue;
    }

    pillow = inspect();
    if (pillow.status === 0 && pillow.stdout.trim() === expected) return invocation;
    attempts.push(label + ": Pillow " + expected + " unavailable");
  }

  throw new Error(
    "Python 3 with pip is required for canonical image reconstruction. Tried: " +
      attempts.join("; ") +
      ". Install Python 3 and ensure the Windows 'py' launcher or python executable is available."
  );
}
export function ensureAssetReconstructionRuntime({ distribution, plan }) {
  if (verifyMaterializedAssets(plan).length === 0) return null;
  return resolvePython(distribution);
}
function reconstruct(distribution, plan, stage) {
  const python = resolvePython(distribution),
    candidateRoot = join(stage, "candidates"),
    tmp = mkdtempSync(join(tmpdir(), "ysabelle-assets-")),
    jobsPath = join(tmp, "jobs.json"),
    summary = join(tmp, "summary.json");
  try {
    const jobs = [];
    for (const [id, records] of group(plan)) {
      const o = records.get("original");
      if (!o || verify(o.sourcePath, o)) throw new Error("Pinned original mismatch: " + id);
      const dest = join(stage, o.relativePath);
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(o.sourcePath, dest);
      jobs.push({
        productCode: id,
        fileId: id,
        sourcePath: o.sourcePath,
        reconciliationStatus: "EXACT_MATCH"
      });
    }
    writeFileSync(jobsPath, JSON.stringify(jobs, null, 2) + "\n");
    runPython(python, [
      join(ROOT, distribution.reconstruction.engineBatchPath),
      jobsPath,
      candidateRoot,
      summary
    ]);
    for (const id of group(plan).keys()) {
      const candidate = join(candidateRoot, id);
      const processed = join(candidate, "processed");
      mkdirSync(processed, { recursive: true });
      for (const fileName of ["processed.webp", "card.webp", "pdp.webp"]) {
        const generated = join(candidate, fileName);
        const target = join(processed, fileName);
        if (!existsSync(generated)) {
          throw new Error("Image engine did not generate " + id + "/" + fileName);
        }
        renameSync(generated, target);
      }
    }
    const aliases = processedCardAliases(plan);
    for (const id of aliases) {
      const d = join(candidateRoot, id, "processed");
      copyFileSync(join(d, "card.webp"), join(d, "processed.webp"));
    }
    const errors = verifyMaterializedAssets(plan, stage);
    if (errors.length) throw new Error("Exact reconstruction failed:\n" + errors.join("\n"));
    return aliases.size;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
function candidateIds(plan) {
  return [...new Set(plan.map((r) => r.candidateId))].sort();
}
export function materializeAssetPayload({ state, distribution, plan, runtimeRoot }) {
  if (verifyMaterializedAssets(plan).length === 0)
    return {
      status: "NOOP",
      candidateCount: candidateIds(plan).length,
      fileCount: plan.length,
      aliasCount: processedCardAliases(plan).size,
      backupRoot: null
    };
  mkdirSync(runtimeRoot, { recursive: true });
  const tag = String(state.releaseId || "unknown").replace(/[^a-zA-Z0-9._-]/g, "_"),
    stage = join(runtimeRoot, ".canonical-stage-" + tag + "-" + process.pid),
    backup = join(runtimeRoot, ".canonical-backups", tag + "-" + Date.now()),
    swapped = [];
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  try {
    const aliasCount = reconstruct(distribution, plan, stage);
    for (const id of candidateIds(plan)) {
      const src = join(stage, "candidates", id),
        dst = join(runtimeRoot, "candidates", id),
        bak = join(backup, id);
      mkdirSync(dirname(dst), { recursive: true });
      let backedUp = false;
      if (existsSync(dst)) {
        mkdirSync(dirname(bak), { recursive: true });
        renameSync(dst, bak);
        backedUp = true;
      }
      renameSync(src, dst);
      swapped.push({ dst, bak, backedUp });
    }
    const errors = verifyMaterializedAssets(plan);
    if (errors.length) throw new Error(errors.join("\n"));
    rmSync(stage, { recursive: true, force: true });
    const keep = swapped.some((x) => x.backedUp);
    if (!keep) rmSync(backup, { recursive: true, force: true });
    return {
      status: "APPLIED",
      candidateCount: candidateIds(plan).length,
      fileCount: plan.length,
      aliasCount,
      backupRoot: keep ? backup : null
    };
  } catch (e) {
    for (const x of [...swapped].reverse()) {
      rmSync(x.dst, { recursive: true, force: true });
      if (x.backedUp && existsSync(x.bak)) {
        mkdirSync(dirname(x.dst), { recursive: true });
        renameSync(x.bak, x.dst);
      }
    }
    rmSync(stage, { recursive: true, force: true });
    throw e;
  }
}
export function resolveRuntimeRoot(env = process.env) {
  if (env.YSABELLE_CATALOG_IMAGE_ROOT?.trim())
    return resolve(env.YSABELLE_CATALOG_IMAGE_ROOT.trim());
  if (process.platform === "win32") {
    const b = env.LOCALAPPDATA?.trim() || env.APPDATA?.trim();
    if (b) return join(b, "YsabelleStore", "catalog-images");
  }
  if (process.platform === "darwin")
    return join(homedir(), "Library", "Application Support", "YsabelleStore", "catalog-images");
  return join(
    env.XDG_DATA_HOME?.trim() || join(homedir(), ".local", "share"),
    "YsabelleStore",
    "catalog-images"
  );
}
export function loadAssetDistribution(root = ROOT, runtimeRoot = resolveRuntimeRoot()) {
  const state = JSON.parse(readFileSync(join(root, STATE))),
    release = JSON.parse(readFileSync(join(root, state.canonicalReleasePath))),
    reconciliation = JSON.parse(readFileSync(join(root, RECON))),
    distribution = JSON.parse(readFileSync(join(root, DIST))),
    recordsText = gunzipSync(readFileSync(join(root, distribution.recordsPath))).toString("utf8");
  return {
    state,
    distribution,
    plan: buildAssetMaterializationPlan({
      release,
      reconciliation,
      recordsText,
      runtimeRoot,
      root
    }),
    runtimeRoot
  };
}
async function main() {
  const x = loadAssetDistribution(),
    allow =
      process.argv.includes("--allow-unready-rehearsal") ||
      process.env.YSABELLE_PHASE4_ALLOW_UNREADY_REHEARSAL === "1";
  if (!x.distribution.distributionPayloadReady && !allow) {
    console.warn("CANONICAL_ASSET_MATERIALIZE=DEFERRED");
    return;
  }
  if (process.argv.includes("--verify-only")) {
    const e = verifyMaterializedAssets(x.plan);
    if (e.length) throw new Error(e.join("\n"));
    console.log("CANONICAL_ASSET_VERIFY=PASS files=" + x.plan.length);
    return;
  }
  const r = materializeAssetPayload({
    state: x.state,
    distribution: x.distribution,
    plan: x.plan,
    runtimeRoot: x.runtimeRoot
  });
  console.log(
    "CANONICAL_ASSET_MATERIALIZE=" +
      r.status +
      " candidates=" +
      r.candidateCount +
      " files=" +
      r.fileCount +
      " aliases=" +
      r.aliasCount
  );
  if (r.backupRoot) console.log("CANONICAL_ASSET_BACKUP=" + r.backupRoot);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  main().catch((e) => {
    console.error("CANONICAL_ASSET_MATERIALIZE=ERROR");
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
