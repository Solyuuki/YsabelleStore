import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export type CatalogImageStoragePaths = {
  root: string;
  fallbackRoots: string[];
};

export function resolveDefaultCatalogImagePersistentRoot(options: {
  environment?: NodeJS.ProcessEnv;
  homeDirectory: string;
  platform: NodeJS.Platform;
}) {
  const environment = options.environment ?? process.env;
  let dataRoot: string;

  if (options.platform === "win32") {
    dataRoot =
      environment.LOCALAPPDATA?.trim() ||
      environment.APPDATA?.trim() ||
      path.join(options.homeDirectory, "AppData", "Local");
  } else if (options.platform === "darwin") {
    dataRoot = path.join(options.homeDirectory, "Library", "Application Support");
  } else {
    dataRoot = environment.XDG_DATA_HOME?.trim() || path.join(options.homeDirectory, ".local", "share");
  }

  return path.resolve(dataRoot, "YsabelleStore", "catalog-images");
}

export function resolveCatalogImageStoragePaths(
  repositoryRoot: string,
  configuredRoot: string,
  persistentRoot?: string
): CatalogImageStoragePaths {
  const normalizedRepositoryRoot = path.resolve(repositoryRoot);

  if (path.isAbsolute(configuredRoot)) {
    return {
      root: path.resolve(configuredRoot),
      fallbackRoots: []
    };
  }

  const repositoryRoots = discoverGitRepositoryRoots(normalizedRepositoryRoot);
  const legacyRoots = Array.from(
    new Set(repositoryRoots.map((candidateRoot) => path.resolve(candidateRoot, configuredRoot)))
  );
  const root = persistentRoot
    ? path.resolve(persistentRoot)
    : (legacyRoots[0] ?? path.resolve(normalizedRepositoryRoot, configuredRoot));
  const fallbackRoots = legacyRoots.filter((candidateRoot) => candidateRoot !== root);

  return { root, fallbackRoots };
}

function discoverGitRepositoryRoots(repositoryRoot: string) {
  const gitDirectory = resolveGitDirectory(repositoryRoot);
  if (!gitDirectory) {
    return [repositoryRoot];
  }

  const commonGitDirectory = resolveCommonGitDirectory(gitDirectory);
  const primaryRepositoryRoot = path.dirname(commonGitDirectory);
  const roots = new Set<string>([primaryRepositoryRoot, repositoryRoot]);
  const worktreesDirectory = path.join(commonGitDirectory, "worktrees");

  try {
    for (const entry of readdirSync(worktreesDirectory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;

      const metadataDirectory = path.join(worktreesDirectory, entry.name);
      const worktreeGitFile = readTextFile(path.join(metadataDirectory, "gitdir"));
      if (!worktreeGitFile) continue;

      const resolvedGitFile = path.isAbsolute(worktreeGitFile)
        ? path.normalize(worktreeGitFile)
        : path.resolve(metadataDirectory, worktreeGitFile);
      roots.add(path.dirname(resolvedGitFile));
    }
  } catch {
    // No linked worktrees are registered for this repository.
  }

  return Array.from(roots);
}

function resolveGitDirectory(repositoryRoot: string) {
  const dotGitPath = path.join(repositoryRoot, ".git");

  try {
    if (statSync(dotGitPath).isDirectory()) {
      return dotGitPath;
    }
  } catch {
    return null;
  }

  const pointer = readTextFile(dotGitPath);
  const match = pointer?.match(/^gitdir:\s*(.+)$/i);
  if (!match?.[1]) {
    return null;
  }

  return path.isAbsolute(match[1])
    ? path.normalize(match[1])
    : path.resolve(repositoryRoot, match[1]);
}

function resolveCommonGitDirectory(gitDirectory: string) {
  const commonDirectoryPointer = readTextFile(path.join(gitDirectory, "commondir"));
  if (commonDirectoryPointer) {
    return path.isAbsolute(commonDirectoryPointer)
      ? path.normalize(commonDirectoryPointer)
      : path.resolve(gitDirectory, commonDirectoryPointer);
  }

  const parentDirectory = path.dirname(gitDirectory);
  if (path.basename(parentDirectory) === "worktrees") {
    return path.dirname(parentDirectory);
  }

  return gitDirectory;
}

function readTextFile(filePath: string) {
  try {
    return readFileSync(filePath, "utf8").trim();
  } catch {
    return null;
  }
}
