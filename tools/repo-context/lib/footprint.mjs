import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const TEXT_EXTENSIONS = new Set([
  '.c', '.cc', '.cjs', '.cpp', '.css', '.env', '.h', '.html', '.ini', '.java', '.js', '.json',
  '.jsx', '.md', '.mjs', '.prisma', '.py', '.sh', '.sql', '.toml', '.ts', '.tsx', '.txt', '.xml',
  '.yaml', '.yml',
]);

const IGNORED_DIRECTORIES = new Set([
  '.git', '.ysabelle-context', 'node_modules', 'dist', 'build', 'coverage', '.vite', '.cache',
]);

function isTextLike(filePath) {
  const base = path.basename(filePath).toLowerCase();
  if (base === 'dockerfile' || base === 'makefile') return true;
  return TEXT_EXTENSIONS.has(path.extname(base));
}

async function collect(rootDir, relativeDir = '') {
  const absoluteDir = path.join(rootDir, relativeDir);
  const entries = await readdir(absoluteDir, { withFileTypes: true });
  let fileCount = 0;
  let characters = 0;

  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const relativePath = path.join(relativeDir, entry.name);
    const absolutePath = path.join(rootDir, relativePath);
    if (entry.isDirectory()) {
      const nested = await collect(rootDir, relativePath);
      fileCount += nested.fileCount;
      characters += nested.characters;
      continue;
    }
    if (!entry.isFile() || !isTextLike(relativePath)) continue;
    const metadata = await stat(absolutePath);
    characters += metadata.size;
    fileCount += 1;
  }

  return { fileCount, characters };
}

export function estimateContextTokens(value) {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  const characters = serialized.length;
  return { characters, approxTokens: Math.ceil(characters / 4) };
}

export async function estimateRepositoryTextFootprint(rootDir) {
  const result = await collect(rootDir);
  return { ...result, approxTokens: Math.ceil(result.characters / 4) };
}
