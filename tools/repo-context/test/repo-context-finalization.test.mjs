import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { getRelevantContext } from "../lib/context-core.mjs";
import { handleMcpRequest } from "../lib/mcp-handler.mjs";
import { createRepositoryContextRuntime } from "../lib/repository-runtime.mjs";
import {
  buildAndPersistIndex,
  getContextStatus,
  loadPersistedContext,
  refreshContext
} from "../lib/runtime.mjs";
import { runCli } from "../cli.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function git(root, ...args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function captureStream() {
  let value = "";
  return {
    stream: {
      write(chunk) {
        value += String(chunk);
      }
    },
    read() {
      return value;
    }
  };
}

async function fixtureRepo() {
  const root = await mkdtemp(path.join(os.tmpdir(), "ysabelle-context-final-"));
  await mkdir(path.join(root, "config"), { recursive: true });
  await mkdir(path.join(root, "backend/src/services"), { recursive: true });
  await mkdir(path.join(root, "backend/src/modules/forecasting"), { recursive: true });
  await mkdir(path.join(root, "frontend/src/pages"), { recursive: true });

  const config = {
    schemaVersion: 1,
    repository: "YsabelleStore",
    defaultVerificationTier: 1,
    ignoredContextPaths: [".ysabelle-context/"],
    authoritativeSources: { projectScope: "docs/PROJECT-SCOPE.md" },
    subsystems: {
      inventory: {
        description: "Inventory.",
        keywords: ["inventory", "stock", "deduction"],
        pathPrefixes: [
          "backend/src/services/inventoryService.ts",
          "backend/src/services/stockDomainService.ts"
        ],
        guidance: ["docs/api/PRODUCT-INVENTORY-CONTRACT.md"],
        invariants: ["Stock stays valid."],
        verification: ["npm run inventory:audit"],
        verificationTier: 3
      },
      "pos-sales": {
        description: "POS.",
        keywords: ["pos", "sale", "checkout"],
        pathPrefixes: ["backend/src/services/posService.ts", "frontend/src/pages/PosPage.tsx"],
        guidance: [],
        invariants: ["Sale and inventory effects remain atomic."],
        verification: [],
        verificationTier: 3
      }
    },
    flows: {
      "pos-sale-to-stock": {
        description: "POS checkout creates sale items and invalidates forecast cache.",
        subsystems: ["pos-sales", "inventory"],
        primaryPaths: [
          "backend/src/services/posService.ts",
          "backend/src/services/stockDomainService.ts"
        ],
        secondaryPaths: [
          "frontend/src/pages/PosPage.tsx",
          "backend/src/modules/forecasting/forecast.service.ts"
        ]
      }
    }
  };

  await writeFile(
    path.join(root, "config/repository-context.json"),
    JSON.stringify(config, null, 2)
  );
  await writeFile(
    path.join(root, "backend/src/services/inventoryService.ts"),
    "export const stock = 1;\n"
  );
  await writeFile(
    path.join(root, "backend/src/services/stockDomainService.ts"),
    "export const mutate = 1;\n"
  );
  await writeFile(
    path.join(root, "backend/src/services/posService.ts"),
    "export const sale = 1;\n"
  );
  await writeFile(
    path.join(root, "backend/src/modules/forecasting/forecast.service.ts"),
    "export const forecast = 1;\n"
  );
  await writeFile(path.join(root, "frontend/src/pages/PosPage.tsx"), "export const Pos = 1;\n");
  await writeFile(path.join(root, ".gitignore"), ".ysabelle-context/\n");

  git(root, "init", "-q");
  git(root, "config", "user.email", "test@example.com");
  git(root, "config", "user.name", "Test");
  git(root, "add", ".");
  git(root, "commit", "-qm", "initial");
  return { root, config };
}

test("returns primary implementation files before secondary dependency files", async () => {
  const { root, config } = await fixtureRepo();
  const built = await buildAndPersistIndex({ rootDir: root });
  const context = getRelevantContext(
    "Fix POS stock deduction after a completed sale",
    built.index,
    config
  );

  assert.deepEqual(context.primaryFiles, [
    "backend/src/services/posService.ts",
    "backend/src/services/stockDomainService.ts"
  ]);
  assert.deepEqual(context.secondaryFiles.slice(0, 2), [
    "frontend/src/pages/PosPage.tsx",
    "backend/src/modules/forecasting/forecast.service.ts"
  ]);
  assert.deepEqual(context.likelyFiles, [...context.primaryFiles, ...context.secondaryFiles]);
});

test("reuses persisted context and refreshes mapped changes incrementally", async () => {
  const { root } = await fixtureRepo();
  const built = await buildAndPersistIndex({ rootDir: root });
  const persisted = await loadPersistedContext(root);
  assert.equal(persisted.state.indexedCommit, built.state.indexedCommit);

  await writeFile(
    path.join(root, "backend/src/services/inventoryService.ts"),
    "export const stock = 2;\n"
  );
  let status = await getContextStatus({ rootDir: root, config: built.config, ...persisted });
  assert.equal(status.stale, true);
  assert.deepEqual(status.affectedSubsystems, ["inventory"]);
  assert.equal(status.requiresFullRefresh, false);

  const refreshed = await refreshContext({ rootDir: root });
  assert.equal(refreshed.mode, "incremental");
  assert.deepEqual(refreshed.refreshedSubsystems, ["inventory"]);

  status = await getContextStatus({
    rootDir: root,
    config: refreshed.config,
    index: refreshed.index,
    state: refreshed.state
  });
  assert.equal(status.stale, false);
});

test("unmapped changes safely fall back to a full refresh", async () => {
  const { root } = await fixtureRepo();
  const built = await buildAndPersistIndex({ rootDir: root });
  await writeFile(path.join(root, "UNMAPPED-CONTEXT-FILE.txt"), "changed\n");

  const persisted = await loadPersistedContext(root);
  const status = await getContextStatus({ rootDir: root, config: built.config, ...persisted });
  assert.equal(status.stale, true);
  assert.equal(status.requiresFullRefresh, true);
  assert.deepEqual(status.unmappedPaths, ["UNMAPPED-CONTEXT-FILE.txt"]);

  const refreshed = await refreshContext({ rootDir: root });
  assert.equal(refreshed.mode, "full");
});

test("runtime ensureFresh clears stale mapped context before task retrieval", async () => {
  const { root } = await fixtureRepo();
  const runtime = await createRepositoryContextRuntime({ rootDir: root });
  await writeFile(
    path.join(root, "backend/src/services/inventoryService.ts"),
    "export const stock = 3;\n"
  );
  assert.equal((await runtime.getStatus()).stale, true);

  const freshness = await runtime.ensureFresh();
  assert.equal(freshness.refreshed, true);
  assert.equal(freshness.mode, "incremental");
  assert.equal((await runtime.getStatus()).stale, false);
});

test("MCP task lookup refreshes stale context automatically", async () => {
  const { root } = await fixtureRepo();
  const runtime = await createRepositoryContextRuntime({ rootDir: root });
  await writeFile(
    path.join(root, "backend/src/services/inventoryService.ts"),
    "export const stock = 4;\n"
  );
  assert.equal((await runtime.getStatus()).stale, true);

  const response = await handleMcpRequest(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "find_relevant_context",
        arguments: { task: "Fix inventory stock deduction" }
      }
    },
    runtime
  );

  const payload = JSON.parse(response.result.content[0].text);
  assert.equal(response.result.isError, false);
  assert.equal(payload.contextRefresh.refreshed, true);
  assert.equal(payload.contextRefresh.mode, "incremental");
  assert.equal((await runtime.getStatus()).stale, false);
});

test("CLI query refreshes stale context automatically while status stays diagnostic", async () => {
  const { root } = await fixtureRepo();
  await buildAndPersistIndex({ rootDir: root });
  await writeFile(
    path.join(root, "backend/src/services/inventoryService.ts"),
    "export const stock = 5;\n"
  );

  const statusOut = captureStream();
  const statusErr = captureStream();
  assert.equal(
    await runCli(["status", "--json"], {
      rootDir: root,
      stdout: statusOut.stream,
      stderr: statusErr.stream
    }),
    0
  );
  assert.equal(JSON.parse(statusOut.read()).stale, true);

  const queryOut = captureStream();
  const queryErr = captureStream();
  assert.equal(
    await runCli(["query", "Fix", "inventory", "stock", "--json"], {
      rootDir: root,
      stdout: queryOut.stream,
      stderr: queryErr.stream
    }),
    0
  );
  const query = JSON.parse(queryOut.read());
  assert.equal(query.contextRefresh.refreshed, true);
  assert.equal(query.contextRefresh.mode, "incremental");

  const runtime = await createRepositoryContextRuntime({ rootDir: root });
  assert.equal((await runtime.getStatus()).stale, false);
});

test("canonical guidance no longer routes routine work through retired sources", async () => {
  const config = JSON.parse(
    await readFile(path.join(projectRoot, "config/repository-context.json"), "utf8")
  );
  assert.equal(config.authoritativeSources.projectScope, "docs/PROJECT-SCOPE.md");
  assert.equal(
    config.authoritativeSources.repositoryLayout,
    "docs/architecture/03-folder-architecture.md"
  );
  assert.equal(
    config.authoritativeSources.moduleOwnership,
    "docs/architecture/08-module-ownership.md"
  );

  const serializedGuidance = JSON.stringify(
    Object.values(config.subsystems).flatMap((subsystem) => subsystem.guidance ?? [])
  );
  assert.equal(serializedGuidance.includes("docs/standards/02-folder-map.md"), false);
  assert.equal(serializedGuidance.includes("docs/standards/07-member-ownership.md"), false);
});

test("consolidated human guidance does not reintroduce known stale assumptions", async () => {
  const [projectScope, folderMap, ownership, goldenRules, readme] = await Promise.all([
    readFile(path.join(projectRoot, "docs/PROJECT-SCOPE.md"), "utf8"),
    readFile(path.join(projectRoot, "docs/standards/02-folder-map.md"), "utf8"),
    readFile(path.join(projectRoot, "docs/standards/07-member-ownership.md"), "utf8"),
    readFile(path.join(projectRoot, "docs/standards/010-golden-rules.md"), "utf8"),
    readFile(path.join(projectRoot, "README.md"), "utf8")
  ]);

  assert.match(projectScope, /Current Implemented Extensions/i);
  assert.match(projectScope, /owner approval/i);
  assert.equal(folderMap.includes("app/frontend/"), false);
  assert.equal(folderMap.includes("app/backend/"), false);
  assert.equal(ownership.includes("app/frontend/"), false);
  assert.ok(goldenRules.length < 8000, "golden rules should remain a compact policy router");
  assert.equal(readme.includes("Sprint 1 foundation integrated with static frontend shell"), false);
  assert.equal(readme.includes("Business modules              | Not started"), false);
});
