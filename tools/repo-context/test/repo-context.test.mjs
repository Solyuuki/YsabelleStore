import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';

import {
  buildContextIndex,
  chooseVerificationTier,
  detectChangedSubsystems,
  getRelevantContext,
  mapPathToSubsystems,
  routeTask,
  shouldEscalateDiscovery,
} from '../lib/context-core.mjs';
import { handleMcpRequest } from '../lib/mcp-handler.mjs';
import { createRepositoryContextRuntime } from '../lib/repository-runtime.mjs';
import { buildAndPersistIndex, getContextStatus, loadPersistedContext, refreshContext } from '../lib/runtime.mjs';
import { estimateContextTokens } from '../lib/footprint.mjs';
import { serveStdio } from '../mcp-server.mjs';

const config = {
  schemaVersion: 1,
  repository: 'YsabelleStore',
  defaultVerificationTier: 1,
  ignoredContextPaths: ['.ysabelle-context/'],
  subsystems: {
    inventory: {
      description: 'Inventory.',
      keywords: ['inventory', 'stock', 'batch', 'deduction'],
      pathPrefixes: ['backend/src/services/inventoryService.ts', 'backend/src/services/stockDomainService.ts'],
      guidance: ['docs/api/PRODUCT-INVENTORY-CONTRACT.md'],
      invariants: ['Stock stays valid.'],
      verification: ['npm run inventory:audit'],
      verificationTier: 3
    },
    pos: {
      description: 'POS.',
      keywords: ['pos', 'sale', 'checkout'],
      pathPrefixes: ['backend/src/services/posService.ts', 'frontend/src/pages/PosPage.tsx'],
      guidance: [],
      invariants: ['Sale and inventory effects remain atomic.'],
      verification: [],
      verificationTier: 3
    },
    'agent-context': {
      description: 'Repository context tooling.',
      keywords: ['codex', 'context', 'mcp', 'token'],
      pathPrefixes: ['tools/repo-context/', '.agents/skills/'],
      guidance: [],
      invariants: ['Cache is not source authority.'],
      verification: ['npm run repo:context:test'],
      verificationTier: 1
    }
  },
  flows: {
    'pos-sale-to-stock': {
      description: 'POS sale allocates stock.',
      subsystems: ['pos', 'inventory'],
      paths: ['frontend/src/pages/PosPage.tsx', 'backend/src/services/posService.ts', 'backend/src/services/stockDomainService.ts']
    }
  }
};

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

async function fixtureRepo() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ysabelle-context-'));
  await mkdir(path.join(root, 'config'), { recursive: true });
  await mkdir(path.join(root, 'backend/src/services'), { recursive: true });
  await mkdir(path.join(root, 'frontend/src/pages'), { recursive: true });
  await writeFile(path.join(root, 'config/repository-context.json'), JSON.stringify(config, null, 2));
  await writeFile(path.join(root, 'backend/src/services/inventoryService.ts'), 'export const stock = 1;\n');
  await writeFile(path.join(root, 'backend/src/services/posService.ts'), 'export const sale = 1;\n');
  await writeFile(path.join(root, 'frontend/src/pages/PosPage.tsx'), 'export const Pos = 1;\n');
  await writeFile(path.join(root, '.gitignore'), '.ysabelle-context/\n');
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'initial');
  return root;
}

async function waitForLine(stream) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const onData = (chunk) => {
      buffer += chunk.toString();
      const index = buffer.indexOf('\n');
      if (index === -1) return;
      cleanup();
      resolve(buffer.slice(0, index));
    };
    const onError = (error) => { cleanup(); reject(error); };
    const cleanup = () => { stream.off('data', onData); stream.off('error', onError); };
    stream.on('data', onData);
    stream.on('error', onError);
  });
}

test('routes tasks and paths to the smallest useful subsystem set', () => {
  assert.deepEqual(mapPathToSubsystems('backend/src/services/inventoryService.ts', config), ['inventory']);
  const routed = routeTask('Fix POS stock deduction after sale', config);
  assert.deepEqual(routed.subsystems.slice(0, 2).sort(), ['inventory', 'pos']);
  assert.equal(routeTask('Reduce Codex MCP token context', config).subsystems[0], 'agent-context');
});

test('maps changed paths, verification tiers, and escalation rules', () => {
  const changed = detectChangedSubsystems(['backend/src/services/posService.ts'], config);
  assert.deepEqual(changed.subsystems, ['pos']);
  assert.equal(chooseVerificationTier(['inventory', 'pos'], config), 3);
  assert.equal(shouldEscalateDiscovery({ contextFound: true, stale: false }), false);
  assert.equal(shouldEscalateDiscovery({ contextFound: true, stale: true }), true);
});

test('builds compact metadata without copying source contents', async () => {
  const root = await fixtureRepo();
  const index = await buildContextIndex({ rootDir: root, config, gitState: { commit: 'abc123' } });
  assert.ok(index.subsystems.pos.files.includes('backend/src/services/posService.ts'));
  assert.equal(JSON.stringify(index).includes('export const sale'), false);
});

test('returns compact task context with one relevant flow and at most eight files', async () => {
  const root = await fixtureRepo();
  const built = await buildContextIndex({ rootDir: root, config, gitState: { commit: 'abc123' } });
  const context = getRelevantContext('Fix POS stock deduction after sale', built, config);
  assert.deepEqual(context.subsystems.sort(), ['inventory', 'pos']);
  assert.equal(context.verificationTier, 3);
  assert.ok(context.likelyFiles.length <= 8);
  assert.deepEqual(context.relatedFlows.map((flow) => flow.name), ['pos-sale-to-stock']);
  assert.ok(estimateContextTokens(context).approxTokens > 0);
});

test('persists context, detects a changed file, and incrementally refreshes it', async () => {
  const root = await fixtureRepo();
  const built = await buildAndPersistIndex({ rootDir: root });
  let status = await getContextStatus({ rootDir: root, config: built.config, index: built.index, state: built.state });
  assert.equal(status.stale, false);
  await writeFile(path.join(root, 'backend/src/services/inventoryService.ts'), 'export const stock = 2;\n');
  const persisted = await loadPersistedContext(root);
  status = await getContextStatus({ rootDir: root, config: built.config, ...persisted });
  assert.equal(status.stale, true);
  assert.deepEqual(status.affectedSubsystems, ['inventory']);
  const refreshed = await refreshContext({ rootDir: root });
  assert.equal(refreshed.mode, 'incremental');
  assert.deepEqual(refreshed.refreshedSubsystems, ['inventory']);
});

test('MCP handler exposes context, freshness, refresh, and mismatch tools', async () => {
  const root = await fixtureRepo();
  const runtime = await createRepositoryContextRuntime({ rootDir: root });
  const listed = await handleMcpRequest({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }, runtime);
  const names = listed.result.tools.map((tool) => tool.name);
  for (const name of ['find_relevant_context', 'changed_since_index', 'refresh_context', 'report_context_mismatch']) {
    assert.ok(names.includes(name));
  }
  const called = await handleMcpRequest({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'find_relevant_context', arguments: { task: 'Fix inventory stock' } } }, runtime);
  assert.deepEqual(JSON.parse(called.result.content[0].text).subsystems, ['inventory']);
  const report = await runtime.reportMismatch({ summary: 'Path changed', affectedSubsystems: ['inventory'] });
  assert.equal(report.recorded, true);
  assert.match(await readFile(path.join(root, '.ysabelle-context/mismatches.jsonl'), 'utf8'), /Path changed/);
});

test('STDIO MCP server supports modern discovery and legacy initialize', async () => {
  const root = await fixtureRepo();
  const runtime = await createRepositoryContextRuntime({ rootDir: root });
  const input = new PassThrough();
  const output = new PassThrough();
  const server = serveStdio({ input, output, errorOutput: new PassThrough(), runtime });
  input.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } } })}\n`);
  const discovery = JSON.parse(await waitForLine(output));
  assert.ok(discovery.result.supportedVersions.includes('2026-07-28'));
  input.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } })}\n`);
  const initialized = JSON.parse(await waitForLine(output));
  assert.equal(initialized.result.protocolVersion, '2025-06-18');
  input.end();
  await server;
});
