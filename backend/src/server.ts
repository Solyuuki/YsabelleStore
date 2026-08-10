import "dotenv/config";

import { createApp } from "./app.js";
import { corsOrigins, databaseTarget, env } from "./config/env.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
  const database = databaseTarget
    ? `${databaseTarget.provider}://${databaseTarget.host}:${databaseTarget.port}/${databaseTarget.database}`
    : "not configured";

  console.info(`YsabelleStore backend listening at http://localhost:${env.PORT}`);
  console.info(`Database target: ${database}`);
  console.info(`Allowed renderer origins: ${corsOrigins.join(", ")}`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  void handleStartupError(error);
});

async function handleStartupError(error: NodeJS.ErrnoException) {
  if (error.code === "EADDRINUSE" && env.NODE_ENV === "development") {
    const existingBackend = await findExistingYsabelleBackend(env.PORT);

    if (existingBackend) {
      console.error(
        `Port ${env.PORT} is already occupied by an existing YsabelleStore backend at ${existingBackend}. Stop the owning development stack before starting another backend.`
      );
      process.exitCode = 1;
      return;
    }

    console.error(
      `Port ${env.PORT} is already used by a service that is not the YsabelleStore backend.`
    );
    process.exitCode = 1;
    return;
  }

  console.error("YsabelleStore backend could not start.", error);
  process.exitCode = 1;
}

async function findExistingYsabelleBackend(port: number): Promise<string | null> {
  for (const baseUrl of [`http://localhost:${port}`, `http://127.0.0.1:${port}`]) {
    try {
      const response = await fetch(`${baseUrl}/api/health`, {
        signal: AbortSignal.timeout(1_500)
      });
      const payload: unknown = await response.json();

      if (response.ok && isYsabelleBackendHealth(payload)) {
        return baseUrl;
      }
    } catch {
      // Try the other loopback spelling before identifying an unrelated listener.
    }
  }

  return null;
}

function isYsabelleBackendHealth(payload: unknown): boolean {
  if (!payload || typeof payload !== "object" || !("data" in payload)) return false;

  const data = payload.data;
  return Boolean(
    data &&
    typeof data === "object" &&
    "service" in data &&
    data.service === "ysabellestore-backend"
  );
}
