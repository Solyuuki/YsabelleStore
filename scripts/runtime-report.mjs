import { describeDatabase, resolveDevelopmentRuntime } from "./lib/runtime-config.mjs";

const runtime = resolveDevelopmentRuntime();
const database = describeDatabase(process.env.DATABASE_URL);

console.log("YsabelleStore resolved development runtime");
console.log(`Browser frontend:       ${runtime.frontendUrl}`);
console.log(`Electron renderer:      ${runtime.electronRendererUrl}`);
console.log(`Browser API:            ${runtime.apiBaseUrl}`);
console.log(`Electron API:           ${runtime.apiBaseUrl} (shared renderer configuration)`);
console.log(`Backend process:        shared service at ${runtime.apiBaseUrl}`);
console.log(`Allowed origins:        ${runtime.corsOrigins.join(", ")}`);
console.log(
  `Database:               ${database ? `${database.provider}://${database.host}:${database.port}/${database.database}` : "not configured"}`
);

try {
  const response = await fetch(new URL("/api/health", `${runtime.apiBaseUrl}/`), {
    signal: AbortSignal.timeout(3_000)
  });
  const payload = await response.json();
  const service = payload?.data?.service ?? "unknown service";
  const databaseStatus = payload?.data?.checks?.database ?? "unknown";
  console.log(`Live backend:           ${response.status} ${service}; database=${databaseStatus}`);
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown error";
  console.log(`Live backend:           unavailable (${message})`);
}
