import fs from "node:fs";
import path from "node:path";

export function getRepositoryRoot() {
  let currentDirectory = process.cwd();

  while (true) {
    const packagePath = path.join(currentDirectory, "package.json");
    const dataPath = path.join(currentDirectory, "data", "forecasting");

    if (fs.existsSync(packagePath) && fs.existsSync(dataPath)) {
      return currentDirectory;
    }

    const parentDirectory = path.dirname(currentDirectory);

    if (parentDirectory === currentDirectory) {
      return process.cwd();
    }

    currentDirectory = parentDirectory;
  }
}

export function resolveRepositoryPath(relativePath: string) {
  return path.resolve(getRepositoryRoot(), relativePath);
}
