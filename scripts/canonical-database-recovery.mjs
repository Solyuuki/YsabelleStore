#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(".");
const PRISMA = join(ROOT, "node_modules", "prisma", "build", "index.js");
const SCHEMA = join(ROOT, "database", "prisma", "schema.prisma");

export function parseMysqlDatabaseUrl(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== "mysql:") {
    throw new Error("Recovery requires MySQL DATABASE_URL");
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!database) throw new Error("DATABASE_URL has no database");
  return {
    host: parsed.hostname,
    port: parsed.port || "3306",
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database
  };
}

export function resolveRecoveryBackupRoot(env = process.env) {
  if (env.YSABELLE_CANONICAL_BACKUP_ROOT?.trim()) {
    return resolve(env.YSABELLE_CANONICAL_BACKUP_ROOT.trim());
  }
  if (process.platform === "win32") {
    const base = env.LOCALAPPDATA?.trim() || env.APPDATA?.trim();
    if (base) return join(base, "YsabelleStore", "backups", "canonical-recovery");
  }
  if (process.platform === "darwin") {
    return join(
      homedir(),
      "Library",
      "Application Support",
      "YsabelleStore",
      "backups",
      "canonical-recovery"
    );
  }
  return join(
    env.XDG_DATA_HOME?.trim() || join(homedir(), ".local", "share"),
    "YsabelleStore",
    "backups",
    "canonical-recovery"
  );
}

export function backupDatabase({
  databaseUrl,
  classification,
  releaseId,
  environment = process.env
}) {
  const connection = parseMysqlDatabaseUrl(databaseUrl);
  const root = resolveRecoveryBackupRoot(environment);
  mkdirSync(root, { recursive: true });
  const safeRelease = String(releaseId).replace(/[^a-zA-Z0-9._-]/g, "_");
  const file = join(
    root,
    new Date().toISOString().replace(/[:.]/g, "-") +
      "-" +
      classification.toLowerCase() +
      "-" +
      safeRelease +
      "-" +
      connection.database +
      ".sql"
  );
  const fd = openSync(file, "wx");

  try {
    const result = spawnSync(
      environment.MYSQLDUMP_EXECUTABLE?.trim() || "mysqldump",
      [
        "--host",
        connection.host,
        "--port",
        connection.port,
        "--user",
        connection.user,
        "--single-transaction",
        "--routines",
        "--triggers",
        "--events",
        "--set-gtid-purged=OFF",
        "--default-character-set=utf8mb4",
        connection.database
      ],
      {
        cwd: ROOT,
        env: { ...environment, MYSQL_PWD: connection.password },
        stdio: ["ignore", fd, "pipe"],
        encoding: "utf8",
        windowsHide: true
      }
    );
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error((result.stderr || "").trim() || "mysqldump failed");
    }
  } catch (error) {
    rmSync(file, { force: true });
    throw new Error(
      "Canonical recovery backup failed; database unchanged. " +
        (error instanceof Error ? error.message : error)
    );
  } finally {
    closeSync(fd);
  }

  if (!existsSync(file) || statSync(file).size === 0) {
    throw new Error("Canonical recovery backup is empty");
  }
  return file;
}

export function resetDatabaseToGeneration2({ environment = process.env } = {}) {
  if (!existsSync(PRISMA)) throw new Error("Local Prisma CLI missing");
  const result = spawnSync(
    process.execPath,
    [
      PRISMA,
      "migrate",
      "reset",
      "--force",
      "--skip-seed",
      "--skip-generate",
      "--schema",
      SCHEMA
    ],
    {
      cwd: ROOT,
      env: environment,
      stdio: "inherit",
      encoding: "utf8",
      windowsHide: true
    }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error("Prisma migrate reset failed: " + result.status);
  }
}
