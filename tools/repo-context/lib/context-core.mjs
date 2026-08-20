import { readdir } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_IGNORES = new Set([
  '.git',
  '.ysabelle-context',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.vite',
  '.cache',
]);

function normalizeRepositoryPath(value) {
  return String(value ?? '')
    .replaceAll('\\', '/')
    .replace(/^\.\//, '');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function matchesPrefix(repositoryPath, prefix) {
  const normalizedPath = normalizeRepositoryPath(repositoryPath).toLowerCase();
  const normalizedPrefix = normalizeRepositoryPath(prefix).toLowerCase();
  return normalizedPath === normalizedPrefix || normalizedPath.startsWith(normalizedPrefix);
}

export function mapPathToSubsystems(repositoryPath, config) {
  const matches = [];
  for (const [name, subsystem] of Object.entries(config.subsystems ?? {})) {
    if ((subsystem.pathPrefixes ?? []).some((prefix) => matchesPrefix(repositoryPath, prefix))) {
      matches.push(name);
    }
  }
  return matches;
}

function scoreKeyword(text, keyword) {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return 0;
  if (normalized.includes(' ')) return text.includes(normalized) ? 4 : 0;

  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const word = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
  return word.test(text) ? 2 : 0;
}

export function routeTask(task, config, { maxSubsystems = 4 } = {}) {
  const normalizedTask = String(task ?? '').toLowerCase();
  const scores = {};

  for (const [name, subsystem] of Object.entries(config.subsystems ?? {})) {
    let score = 0;
    for (const keyword of subsystem.keywords ?? []) {
      score += scoreKeyword(normalizedTask, keyword);
    }
    scores[name] = score;
  }

  const ranked = Object.entries(scores)
    .filter(([, score]) => score > 0)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, maxSubsystems)
    .map(([name]) => name);

  return { subsystems: ranked, scores };
}

export function detectChangedSubsystems(changedPaths, config) {
  const subsystemSet = new Set();
  const unmappedPaths = [];

  for (const changedPath of changedPaths ?? []) {
    const matches = mapPathToSubsystems(changedPath, config);
    if (matches.length === 0) {
      unmappedPaths.push(normalizeRepositoryPath(changedPath));
      continue;
    }
    for (const subsystem of matches) subsystemSet.add(subsystem);
  }

  return {
    subsystems: [...subsystemSet],
    unmappedPaths,
  };
}

export function chooseVerificationTier(subsystems, config) {
  let tier = Number(config.defaultVerificationTier ?? 1);
  for (const name of subsystems ?? []) {
    tier = Math.max(tier, Number(config.subsystems?.[name]?.verificationTier ?? tier));
  }
  return Math.min(3, Math.max(1, tier));
}

export function shouldEscalateDiscovery({
  contextFound = true,
  stale = false,
  contradictory = false,
  unexplainedFailure = false,
  undocumentedSubsystem = false,
  missingPath = false,
} = {}) {
  return (
    !contextFound ||
    stale ||
    contradictory ||
    unexplainedFailure ||
    undocumentedSubsystem ||
    missingPath
  );
}

async function walkFiles(rootDir, relativeDir = '') {
  const absoluteDir = path.join(rootDir, relativeDir);
  let entries;
  try {
    entries = await readdir(absoluteDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    if (DEFAULT_IGNORES.has(entry.name)) continue;
    const relativePath = normalizeRepositoryPath(path.join(relativeDir, entry.name));
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(rootDir, relativePath)));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files;
}

export async function buildContextIndex({ rootDir, config, gitState = {} }) {
  const allFiles = await walkFiles(rootDir);
  const subsystemFiles = new Map(
    Object.keys(config.subsystems ?? {}).map((name) => [name, []]),
  );

  for (const file of allFiles) {
    for (const subsystem of mapPathToSubsystems(file, config)) {
      subsystemFiles.get(subsystem)?.push(file);
    }
  }

  const subsystems = {};
  for (const [name, subsystem] of Object.entries(config.subsystems ?? {})) {
    subsystems[name] = {
      description: subsystem.description ?? '',
      guidance: unique(subsystem.guidance ?? []),
      invariants: unique(subsystem.invariants ?? []),
      verification: unique(subsystem.verification ?? []),
      verificationTier: Number(subsystem.verificationTier ?? config.defaultVerificationTier ?? 1),
      files: unique(subsystemFiles.get(name) ?? []).sort(),
    };
  }

  return {
    schemaVersion: Number(config.schemaVersion ?? 1),
    repository: config.repository ?? path.basename(rootDir),
    source: {
      commit: gitState.commit ?? null,
      branch: gitState.branch ?? null,
      dirty: Boolean(gitState.dirty),
    },
    subsystems,
    flows: config.flows ?? {},
  };
}

function taskTokens(task) {
  return unique(
    String(task ?? '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3),
  );
}

function scoreTextForTokens(text, tokens) {
  const normalized = String(text ?? '').toLowerCase();
  return tokens.reduce((score, token) => score + (normalized.includes(token) ? 1 : 0), 0);
}

function selectRelatedFlows(task, selected, flows, maxFlows = 1) {
  if (selected.length === 0) return [];
  const tokens = taskTokens(task);
  const candidates = Object.entries(flows ?? {})
    .map(([name, flow]) => {
      const overlap = (flow.subsystems ?? []).filter((subsystem) => selected.includes(subsystem)).length;
      const textScore = scoreTextForTokens(`${name} ${flow.description ?? ''}`, tokens);
      return { name, flow, overlap, score: overlap * 10 + textScore };
    })
    .filter((entry) => entry.overlap > 0);

  if (candidates.length === 0) return [];
  const maxOverlap = Math.max(...candidates.map((entry) => entry.overlap));
  return candidates
    .filter((entry) => entry.overlap === maxOverlap)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .slice(0, maxFlows)
    .map(({ name, flow }) => ({ name, ...flow }));
}

function selectLikelyFiles(task, selected, index, relatedFlows, maxFiles = 12) {
  const preferred = unique(relatedFlows.flatMap((flow) => flow.paths ?? []));
  const tokens = taskTokens(task);
  const candidates = unique(
    selected.flatMap((name) => index.subsystems?.[name]?.files ?? []),
  )
    .filter((file) => !preferred.includes(file))
    .map((file) => ({
      file,
      score: scoreTextForTokens(file, tokens),
    }))
    .sort((left, right) => right.score - left.score || left.file.localeCompare(right.file));

  const ranked = [...preferred, ...candidates.map((entry) => entry.file)];
  return unique(ranked).slice(0, maxFiles);
}

export function getRelevantContext(task, index, config, { maxFiles = 8, maxFlows = 1 } = {}) {
  const routed = routeTask(task, config);
  const selected = routed.subsystems.filter((name) => Boolean(index.subsystems?.[name]));
  const guidance = [];
  const invariants = [];
  const verification = [];

  for (const name of selected) {
    const subsystem = index.subsystems[name];
    guidance.push(...(subsystem.guidance ?? []));
    invariants.push(...(subsystem.invariants ?? []));
    verification.push(...(subsystem.verification ?? []));
  }

  const relatedFlows = selectRelatedFlows(task, selected, index.flows ?? {}, maxFlows);
  const likelyFiles = selectLikelyFiles(task, selected, index, relatedFlows, maxFiles);

  return {
    repository: index.repository,
    indexedCommit: index.source?.commit ?? null,
    task: String(task ?? ''),
    subsystems: selected,
    likelyFiles,
    guidance: unique(guidance),
    invariants: unique(invariants),
    verification: unique(verification),
    verificationTier: chooseVerificationTier(selected, config),
    relatedFlows,
    escalationRequired: shouldEscalateDiscovery({ contextFound: selected.length > 0 }),
  };
}
