import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import {
  buildAndPersistIndex,
  contextStoreExists,
  getContextStatus,
  loadContextConfig,
  loadPersistedContext,
  refreshContext,
} from './runtime.mjs';

export async function createRepositoryContextRuntime({ rootDir = process.cwd() } = {}) {
  let config = await loadContextConfig(rootDir);
  let index;
  let state;

  if (await contextStoreExists(rootDir)) {
    ({ index, state } = await loadPersistedContext(rootDir));
  } else {
    const built = await buildAndPersistIndex({ rootDir });
    ({ index, state, config } = built);
  }

  const runtime = {
    rootDir,
    config,
    index,
    state,
    async getStatus() {
      return getContextStatus({
        rootDir,
        config: runtime.config,
        index: runtime.index,
        state: runtime.state,
      });
    },
    async refresh(options = {}) {
      const refreshed = await refreshContext({ rootDir, ...options });
      if (refreshed.index && refreshed.state) {
        runtime.index = refreshed.index;
        runtime.state = refreshed.state;
        runtime.config = refreshed.config ?? runtime.config;
      } else {
        const persisted = await loadPersistedContext(rootDir);
        runtime.index = persisted.index;
        runtime.state = persisted.state;
        runtime.config = await loadContextConfig(rootDir);
      }
      return {
        mode: refreshed.mode,
        stale: false,
        changedPaths: refreshed.changedPaths ?? [],
        refreshedSubsystems: refreshed.refreshedSubsystems ?? [],
      };
    },
    async reportMismatch(details = {}) {
      const summary = String(details.summary ?? '').trim();
      if (!summary) throw new Error('summary is required');
      const status = await runtime.getStatus();
      const record = {
        recordedAt: new Date().toISOString(),
        summary,
        storedExpectation: details.storedExpectation ? String(details.storedExpectation) : null,
        currentReality: details.currentReality ? String(details.currentReality) : null,
        affectedSubsystems: Array.isArray(details.affectedSubsystems)
          ? [...new Set(details.affectedSubsystems.map(String))].sort()
          : [],
        indexedCommit: status.indexedCommit,
        currentCommit: status.currentCommit,
      };
      const storeDir = path.join(rootDir, '.ysabelle-context');
      await mkdir(storeDir, { recursive: true });
      await appendFile(path.join(storeDir, 'mismatches.jsonl'), `${JSON.stringify(record)}\n`, 'utf8');
      return { recorded: true, ...record };
    },
  };

  return runtime;
}
