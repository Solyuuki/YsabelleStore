import fs from "node:fs";
import path from "node:path";

const PACKAGE_PATHS = [
  "package.json",
  "frontend/package.json",
  "backend/package.json",
  "electron/package.json"
];

export function checkVersionConsistency(rootDir = process.cwd()) {
  const packages = new Map(
    PACKAGE_PATHS.map((relativePath) => [relativePath, readJson(rootDir, relativePath)])
  );
  const packageVersion = packages.get("package.json").version;
  const errors = [];

  for (const [relativePath, manifest] of packages) {
    if (manifest.version !== packageVersion) {
      errors.push(
        `${relativePath} version ${manifest.version} does not match root package version ${packageVersion}.`
      );
    }
  }

  const lockfile = readJson(rootDir, "package-lock.json");
  for (const relativePath of PACKAGE_PATHS) {
    const lockKey =
      relativePath === "package.json" ? "" : path.dirname(relativePath).replaceAll("\\", "/");
    const lockVersion = lockfile.packages?.[lockKey]?.version;
    if (lockVersion !== packageVersion) {
      errors.push(
        `package-lock.json entry ${lockKey || "<root>"} version ${lockVersion ?? "missing"} does not match ${packageVersion}.`
      );
    }
  }

  if (lockfile.version !== packageVersion) {
    errors.push(
      `package-lock.json top-level version ${lockfile.version ?? "missing"} does not match ${packageVersion}.`
    );
  }

  const appVersionPath = path.join(rootDir, "frontend", "src", "config", "appVersion.ts");
  const appVersionMatch = fs
    .readFileSync(appVersionPath, "utf8")
    .match(/export const APP_VERSION = "(\d+\.\d+\.\d+)";/);
  const appVersion = appVersionMatch?.[1] ?? null;
  if (!appVersion) {
    errors.push("frontend/src/config/appVersion.ts does not contain a semantic APP_VERSION.");
  }

  return { appVersion, errors, packageVersion };
}

function readJson(rootDir, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8"));
}
