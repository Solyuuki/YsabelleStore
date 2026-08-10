const DEFAULT_FRONTEND_URL = "http://localhost:5173";
const DEFAULT_API_BASE_URL = "http://localhost:3001";

export function resolveDevelopmentRuntime(environment = process.env) {
  const frontendUrl = normalizeUrl(
    environment.FRONTEND_URL ?? DEFAULT_FRONTEND_URL,
    "FRONTEND_URL"
  );
  const apiBaseUrl = normalizeUrl(
    environment.VITE_API_BASE_URL ?? DEFAULT_API_BASE_URL,
    "VITE_API_BASE_URL"
  );
  const electronRendererUrl = normalizeUrl(
    environment.ELECTRON_RENDERER_DEV_URL ?? frontendUrl,
    "ELECTRON_RENDERER_DEV_URL"
  );
  const backendPort = parsePort(environment.PORT, apiBaseUrl, "backend");
  const frontendPort = parsePort(undefined, frontendUrl, "frontend");
  const corsOrigins = (environment.CORS_ORIGINS ?? `${frontendUrl},http://127.0.0.1:5173,null`)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (isLoopback(apiBaseUrl.hostname) && effectivePort(apiBaseUrl) !== backendPort) {
    throw new Error(
      `PORT (${backendPort}) must match the local VITE_API_BASE_URL port (${effectivePort(apiBaseUrl)}).`
    );
  }

  return Object.freeze({
    apiBaseUrl: withoutTrailingSlash(apiBaseUrl),
    backendPort,
    corsOrigins: Object.freeze(corsOrigins),
    electronRendererUrl: withoutTrailingSlash(electronRendererUrl),
    frontendPort,
    frontendUrl: withoutTrailingSlash(frontendUrl)
  });
}

export function describeDatabase(databaseUrl) {
  if (!databaseUrl) return null;

  const parsedDatabaseUrl = new URL(databaseUrl);
  return Object.freeze({
    provider: parsedDatabaseUrl.protocol.replace(/:$/, ""),
    host: parsedDatabaseUrl.hostname,
    port: parsedDatabaseUrl.port || "default",
    database: parsedDatabaseUrl.pathname.replace(/^\//, "") || "(not specified)"
  });
}

export function displayUrl(value) {
  return `${withoutTrailingSlash(new URL(value))}/`;
}

export function isLoopback(hostname) {
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname.toLowerCase());
}

function normalizeUrl(value, variableName) {
  let parsed;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${variableName} must be a valid absolute URL.`);
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error(`${variableName} must use HTTP or HTTPS.`);
  }

  parsed.hash = "";
  parsed.search = "";
  return parsed;
}

function parsePort(configuredPort, url, label) {
  const port = Number(configuredPort ?? effectivePort(url));

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`The ${label} development port is invalid.`);
  }

  return port;
}

function effectivePort(url) {
  if (url.port) return Number(url.port);
  return url.protocol === "https:" ? 443 : 80;
}

function withoutTrailingSlash(url) {
  return url.toString().replace(/\/$/, "");
}
