#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getRelevantContext } from './lib/context-core.mjs';
import { estimateContextTokens, estimateRepositoryTextFootprint } from './lib/footprint.mjs';
import {
  buildAndPersistIndex,
  contextStoreExists,
  getContextStatus,
  loadContextConfig,
  loadPersistedContext,
  refreshContext,
} from './lib/runtime.mjs';

function writeJson(stdout, value) {
  stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function writeHuman(stdout, value) {
  if (typeof value === 'string') {
    stdout.write(`${value}\n`);
    return;
  }
  stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function ensureLoaded(rootDir) {
  const config = await loadContextConfig(rootDir);
  if (!(await contextStoreExists(rootDir))) {
    const built = await buildAndPersistIndex({ rootDir });
    return { config, index: built.index, state: built.state, autoBuilt: true };
  }
  const persisted = await loadPersistedContext(rootDir);
  return { config, ...persisted, autoBuilt: false };
}

function compactBuildResult(result) {
  return {
    mode: result.mode ?? 'full',
    repository: result.index.repository,
    indexedCommit: result.state.indexedCommit,
    indexedBranch: result.state.indexedBranch,
    subsystemCount: Object.keys(result.index.subsystems ?? {}).length,
    flowCount: Object.keys(result.index.flows ?? {}).length,
    dirtySnapshotCount: Object.keys(result.state.dirtyPathHashes ?? {}).length,
  };
}

function compactOverview({ config, index, state }) {
  return {
    repository: index.repository,
    indexedCommit: state.indexedCommit,
    indexedBranch: state.indexedBranch,
    authoritativeSources: config.authoritativeSources ?? {},
    contextWarnings: config.contextWarnings ?? [],
    subsystems: Object.entries(index.subsystems ?? {}).map(([name, subsystem]) => ({
      name,
      description: subsystem.description,
      fileCount: subsystem.files?.length ?? 0,
      verificationTier: subsystem.verificationTier ?? 1,
    })),
    flows: Object.keys(index.flows ?? {}),
  };
}

function usage() {
  return `YsabelleStore repository context\n\nCommands:\n  build [--json]\n  status [--json]\n  overview [--json]\n  query <task...> [--json]\n  subsystem <name> [--json]\n  flow <name> [--json]\n  refresh [--force] [--json]\n  benchmark <task...> [--json]\n`;
}

export async function runCli(
  argv,
  { rootDir = process.cwd(), stdout = process.stdout, stderr = process.stderr } = {},
) {
  const args = [...argv];
  const asJson = args.includes('--json');
  const force = args.includes('--force');
  const cleanArgs = args.filter((arg) => arg !== '--json' && arg !== '--force');
  const [command, ...rest] = cleanArgs;
  const output = asJson ? (value) => writeJson(stdout, value) : (value) => writeHuman(stdout, value);

  try {
    if (!command || command === 'help' || command === '--help' || command === '-h') {
      stdout.write(usage());
      return 0;
    }

    if (command === 'build') {
      const result = await buildAndPersistIndex({ rootDir });
      output(compactBuildResult(result));
      return 0;
    }

    if (command === 'refresh') {
      const result = await refreshContext({ rootDir, force });
      output({
        mode: result.mode,
        stale: result.stale ?? false,
        changedPaths: result.changedPaths ?? [],
        refreshedSubsystems: result.refreshedSubsystems ?? [],
      });
      return 0;
    }

    const loaded = await ensureLoaded(rootDir);

    if (command === 'status') {
      const status = await getContextStatus({ rootDir, ...loaded });
      output({ ...status, autoBuilt: loaded.autoBuilt });
      return 0;
    }

    if (command === 'overview') {
      output(compactOverview(loaded));
      return 0;
    }

    if (command === 'query') {
      const task = rest.join(' ').trim();
      if (!task) throw new Error('query requires a task description.');
      output(getRelevantContext(task, loaded.index, loaded.config));
      return 0;
    }

    if (command === 'benchmark') {
      const task = rest.join(' ').trim();
      if (!task) throw new Error('benchmark requires a task description.');
      const context = getRelevantContext(task, loaded.index, loaded.config);
      const compactContext = estimateContextTokens(context);
      const repositoryText = await estimateRepositoryTextFootprint(rootDir);
      const contextReductionRatio = repositoryText.approxTokens > 0
        ? Math.max(0, Math.min(1, 1 - compactContext.approxTokens / repositoryText.approxTokens))
        : 0;
      output({
        task,
        subsystems: context.subsystems,
        likelyFileCount: context.likelyFiles.length,
        verificationTier: context.verificationTier,
        compactContext,
        repositoryText,
        contextReductionRatio: Number(contextReductionRatio.toFixed(4)),
        note: 'This is a deterministic context-footprint proxy, not actual Codex token billing or model-iteration usage.',
      });
      return 0;
    }

    if (command === 'subsystem') {
      const name = rest[0];
      if (!name) throw new Error('subsystem requires a subsystem name.');
      const subsystem = loaded.index.subsystems?.[name];
      if (!subsystem) throw new Error(`Unknown subsystem: ${name}`);
      output({ name, ...subsystem });
      return 0;
    }

    if (command === 'flow') {
      const name = rest[0];
      if (!name) throw new Error('flow requires a flow name.');
      const flow = loaded.index.flows?.[name];
      if (!flow) throw new Error(`Unknown flow: ${name}`);
      output({ name, ...flow });
      return 0;
    }

    throw new Error(`Unknown command: ${command}`);
  } catch (error) {
    stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  process.exitCode = await runCli(process.argv.slice(2));
}
