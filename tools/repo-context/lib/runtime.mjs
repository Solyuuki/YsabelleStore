import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { access, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { buildContextIndex, detectChangedSubsystems } from './context-core.mjs';

const CONFIG_PATH = 'config/repository-context.json';
const STORE_DIR = '.ysabelle-context';
const INDEX_PATH = `${STORE_DIR}/index.json`;
const STATE_PATH = `${STORE_DIR}/state.json`;

function normalizeRepositoryPath(value) {
  return String(value ?? '')
    .replaceAll('\\', '/')
    .replace(/^\.\//, '');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function runGit(rootDir, args, { allowFailure = false } = {}) {
  try {
    return execFileSync('git', args, {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    if (allowFailure) return null;
    const stderr = error?.stderr?.toString?.().trim();
    throw new Error(stderr || `git ${args.join(' ')} failed`);
  }
}

function runGitNullSeparated(rootDir, args, { allowFailure = false } = {}) {
  const output = runGit(rootDir, args, { allowFailure });
  if (output === null || output === '') return [];
  return output.split('\0').map(normalizeRepositoryPath).filter(Boolean);
}

function isIgnoredContextPath(repositoryPath, config) {
  const normalized = normalizeRepositoryPath(repositoryPath);
  const ignored = config.ignoredContextPaths ?? [`.ysabelle-context/`];
  return ignored.some((prefix) => {
    const normalizedPrefix = normalizeRepositoryPath(prefix);
    return normalized === normalizedPrefix.replace(/\/$/, '') || normalized.startsWith(normalizedPrefix);
  });
}

async function fileHash(rootDir, repositoryPath) {
  const absolutePath = path.join(rootDir, repositoryPath);
  try {
    const fileStat = await stat(absolutePath);
    if (!fileStat.isFile()) return null;
    const content = await readFile(absolutePath);
    return createHash('sha256').update(content).digest('hex');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function currentWorkingTreePaths(rootDir, config) {
  const paths = unique([
    ...runGitNullSeparated(rootDir, ['diff', '--name-only', '-z']),
    ...runGitNullSeparated(rootDir, ['diff', '--cached', '--name-only', '-z']),
    ...runGitNullSeparated(rootDir, ['ls-files', '--others', '--exclude-standard', '-z']),
  ]);
  return paths.filter((entry) => !isIgnoredContextPath(entry, config)).sort();
}

async function capturePathHashes(rootDir, paths) {
  const entries = await Promise.all(
    paths.map(async (repositoryPath) => [repositoryPath, await fileHash(rootDir, repositoryPath)]),
  );
  return Object.fromEntries(entries);
}

async function writeJsonAtomic(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, filePath);
}

function validateSubsystem(name, subsystem) {
  if (!subsystem || typeof subsystem !== 'object') throw new Error(`Subsystem ${name} must be an object.`);
  if (typeof subsystem.description !== 'string') throw new Error(`Subsystem ${name} requires a description.`);
  if (!Array.isArray(subsystem.keywords)) throw new Error(`Subsystem ${name} requires keywords[].`);
  if (!Array.isArray(subsystem.pathPrefixes) || subsystem.pathPrefixes.length === 0) {
    throw new Error(`Subsystem ${name} requires at least one path prefix.`);
  }
  const tier = Number(subsystem.verificationTier ?? 1);
  if (![1, 2, 3].includes(tier)) throw new Error(`Subsystem ${name} has invalid verificationTier ${tier}.`);
}

export async function loadContextConfig(rootDir, configPath = CONFIG_PATH) {
  const absolutePath = path.join(rootDir, configPath);
  const raw = await readFile(absolutePath, 'utf8');
  const config = JSON.parse(raw);

  if (!Number.isInteger(config.schemaVersion) || config.schemaVersion < 1) {
    throw new Error('repository-context config requires a positive integer schemaVersion.');
  }
  if (typeof config.repository !== 'string' || !config.repository.trim()) {
    throw new Error('repository-context config requires repository.');
  }
  if (!config.subsystems || typeof config.subsystems !== 'object') {
    throw new Error('repository-context config requires subsystems.');
  }
  for (const [name, subsystem] of Object.entries(config.subsystems)) validateSubsystem(name, subsystem);
  return config;
}

export async function getGitState(rootDir, config = { ignoredContextPaths: [`.ysabelle-context/`] }) {
  const commit = runGit(rootDir, ['rev-parse', 'HEAD']);
  const branch = runGit(rootDir, ['branch', '--show-current'], { allowFailure: true }) || null;
  const changedPaths = await currentWorkingTreePaths(rootDir, config);
  return {
    branch,
    commit,
    dirty: changedPaths.length > 0,
    changedPaths,
  };
}

async function getCommittedPathsSince(rootDir, indexedCommit, currentCommit, config) {
  if (!indexedCommit || !currentCommit || indexedCommit === currentCommit) return [];
  const mergeBaseCheck = runGit(rootDir, ['merge-base', '--is-ancestor', indexedCommit, currentCommit], {
    allowFailure: true,
  });
  if (mergeBaseCheck === null) {
    return null;
  }
  return runGitNullSeparated(rootDir, ['diff', '--name-only', '-z', `${indexedCommit}..${currentCommit}`]).filter(
    (entry) => !isIgnoredContextPath(entry, config),
  );
}

async function changedWorkingTreePathsSinceSnapshot(rootDir, config, state) {
  const currentPaths = await currentWorkingTreePaths(rootDir, config);
  const captured = state.dirtyPathHashes ?? {};
  const candidates = unique([...currentPaths, ...Object.keys(captured)]).sort();
  const currentHashes = await capturePathHashes(rootDir, candidates);
  return candidates.filter((repositoryPath) => currentHashes[repositoryPath] !== (captured[repositoryPath] ?? null));
}

export async function loadPersistedContext(rootDir) {
  const [indexRaw, stateRaw] = await Promise.all([
    readFile(path.join(rootDir, INDEX_PATH), 'utf8'),
    readFile(path.join(rootDir, STATE_PATH), 'utf8'),
  ]);
  return {
    index: JSON.parse(indexRaw),
    state: JSON.parse(stateRaw),
  };
}

async function persistContext({ rootDir, config, index }) {
  const gitState = await getGitState(rootDir, config);
  const dirtyPathHashes = await capturePathHashes(rootDir, gitState.changedPaths);
  const state = {
    schemaVersion: Number(config.schemaVersion),
    indexedAt: new Date().toISOString(),
    indexedBranch: gitState.branch,
    indexedCommit: gitState.commit,
    dirtyPathHashes,
  };

  index.source = {
    commit: gitState.commit,
    branch: gitState.branch,
    dirty: gitState.dirty,
  };

  await Promise.all([
    writeJsonAtomic(path.join(rootDir, INDEX_PATH), index),
    writeJsonAtomic(path.join(rootDir, STATE_PATH), state),
  ]);
  return { index, state };
}

export async function buildAndPersistIndex({ rootDir, configPath = CONFIG_PATH }) {
  const config = await loadContextConfig(rootDir, configPath);
  const gitState = await getGitState(rootDir, config);
  const index = await buildContextIndex({ rootDir, config, gitState });
  const persisted = await persistContext({ rootDir, config, index });
  return { config, ...persisted, mode: 'full' };
}

export async function getContextStatus({ rootDir, config, index, state }) {
  const currentGit = await getGitState(rootDir, config);
  const committedPaths = await getCommittedPathsSince(
    rootDir,
    state.indexedCommit ?? index.source?.commit,
    currentGit.commit,
    config,
  );

  if (committedPaths === null) {
    return {
      stale: true,
      reason: 'indexed commit is unavailable or not an ancestor of current HEAD',
      changedPaths: [],
      affectedSubsystems: [],
      unmappedPaths: [],
      indexedCommit: state.indexedCommit ?? null,
      currentCommit: currentGit.commit,
      requiresFullRefresh: true,
    };
  }

  const workingPaths = await changedWorkingTreePathsSinceSnapshot(rootDir, config, state);
  const changedPaths = unique([...committedPaths, ...workingPaths]).sort();
  const mapped = detectChangedSubsystems(changedPaths, config);

  return {
    stale: changedPaths.length > 0,
    reason: changedPaths.length > 0 ? 'repository changed since context snapshot' : null,
    changedPaths,
    affectedSubsystems: mapped.subsystems.sort(),
    unmappedPaths: mapped.unmappedPaths.sort(),
    indexedCommit: state.indexedCommit ?? null,
    currentCommit: currentGit.commit,
    requiresFullRefresh: mapped.unmappedPaths.length > 0,
  };
}

export async function refreshContext({ rootDir, configPath = CONFIG_PATH, paths, subsystems, force = false } = {}) {
  const config = await loadContextConfig(rootDir, configPath);
  let persisted;
  try {
    persisted = await loadPersistedContext(rootDir);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    return buildAndPersistIndex({ rootDir, configPath });
  }

  const status = await getContextStatus({ rootDir, config, ...persisted });
  const explicitPaths = (paths ?? []).map(normalizeRepositoryPath);
  const explicitSubsystems = (subsystems ?? []).filter((name) => Boolean(config.subsystems[name]));
  const pathMapping = detectChangedSubsystems(explicitPaths, config);
  const targetSubsystems = unique([
    ...status.affectedSubsystems,
    ...pathMapping.subsystems,
    ...explicitSubsystems,
  ]).sort();

  if (!force && !status.stale && targetSubsystems.length === 0) {
    return {
      mode: 'noop',
      refreshedSubsystems: [],
      stale: false,
      changedPaths: [],
    };
  }

  if (
    force ||
    status.requiresFullRefresh ||
    pathMapping.unmappedPaths.length > 0 ||
    targetSubsystems.length === 0
  ) {
    const result = await buildAndPersistIndex({ rootDir, configPath });
    return {
      ...result,
      mode: 'full',
      refreshedSubsystems: Object.keys(config.subsystems).sort(),
      stale: false,
      changedPaths: unique([...status.changedPaths, ...explicitPaths]),
    };
  }

  const currentGit = await getGitState(rootDir, config);
  const rebuilt = await buildContextIndex({ rootDir, config, gitState: currentGit });
  const nextIndex = structuredClone(persisted.index);
  for (const name of targetSubsystems) {
    nextIndex.subsystems[name] = rebuilt.subsystems[name];
  }
  nextIndex.flows = config.flows ?? nextIndex.flows ?? {};
  nextIndex.schemaVersion = config.schemaVersion;
  nextIndex.repository = config.repository;

  const next = await persistContext({ rootDir, config, index: nextIndex });
  return {
    ...next,
    config,
    mode: 'incremental',
    refreshedSubsystems: targetSubsystems,
    stale: false,
    changedPaths: unique([...status.changedPaths, ...explicitPaths]),
  };
}

export async function ensureContextStoreIgnored(rootDir) {
  const gitignorePath = path.join(rootDir, '.gitignore');
  const raw = await readFile(gitignorePath, 'utf8');
  if (raw.split(/\r?\n/).some((line) => line.trim() === '.ysabelle-context/')) return false;
  const suffix = raw.endsWith('\n') ? '' : '\n';
  await writeFile(gitignorePath, `${raw}${suffix}.ysabelle-context/\n`, 'utf8');
  return true;
}

export async function contextStoreExists(rootDir) {
  try {
    await access(path.join(rootDir, INDEX_PATH));
    await access(path.join(rootDir, STATE_PATH));
    return true;
  } catch {
    return false;
  }
}

export { CONFIG_PATH, INDEX_PATH, STATE_PATH, STORE_DIR };
