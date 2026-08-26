const DISPOSABLE_DATABASE_PATTERN = /(?:^|_)(?:test|ci)(?:_|$)/i;

export function databaseNameFromUrl(databaseUrl) {
  const parsed = new URL(databaseUrl);
  return decodeURIComponent(parsed.pathname.replace(/^\//, ""));
}

export function isDisposableTestDatabaseUrl(databaseUrl) {
  const databaseName = databaseNameFromUrl(databaseUrl);
  return Boolean(databaseName && DISPOSABLE_DATABASE_PATTERN.test(databaseName));
}

export function buildDisposableTestDatabaseUrl(databaseUrl, suffix) {
  const parsed = new URL(databaseUrl);
  if (parsed.protocol !== "mysql:") {
    throw new Error("Backend test database isolation currently supports MySQL DATABASE_URL values only.");
  }

  const baseName = databaseNameFromUrl(databaseUrl);
  if (!baseName) throw new Error("DATABASE_URL must include a database name.");

  const normalizedSuffix = String(suffix ?? "local")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 20);
  if (!normalizedSuffix) throw new Error("Disposable test database suffix must contain letters or digits.");

  parsed.pathname = `/${encodeURIComponent(`${baseName}_test_${normalizedSuffix}`)}`;
  return parsed.toString();
}
