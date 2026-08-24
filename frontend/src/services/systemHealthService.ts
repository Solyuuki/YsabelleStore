import { apiClient } from "@/services/apiClient";

export type SystemHealthState =
  | "checking"
  | "healthy"
  | "degraded"
  | "database-unavailable"
  | "backend-unavailable"
  | "timeout"
  | "offline";

export type HealthCheckData = {
  checks?: {
    database?: string;
    prisma?: string;
  };
  configuration?: {
    databaseUrlLoaded?: boolean;
    jwtSecretLoaded?: boolean;
  };
  database?: {
    message?: string;
  };
  status?: string;
};

const HEALTH_CHECK_TIMEOUT_MS = 2500;

export async function checkSystemHealth(
  timeoutMs = HEALTH_CHECK_TIMEOUT_MS
): Promise<SystemHealthState> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await apiClient.request<HealthCheckData>("/api/health", {
      method: "GET",
      signal: controller.signal
    });

    if (!response.success || !response.data) {
      return "degraded";
    }

    return classifyHealthResponse(response.data);
  } catch (error) {
    return classifyHealthFailure(error, navigator.onLine);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function classifyHealthResponse(data: HealthCheckData): SystemHealthState {
  const databaseStatus = data.checks?.database?.toLowerCase() ?? "";
  const status = data.status?.toLowerCase() ?? "";

  if (status === "healthy" && databaseStatus === "connected" && isConfigurationReady(data)) {
    return "healthy";
  }

  if (
    status === "unavailable" ||
    databaseStatus.includes("unavailable") ||
    databaseStatus.includes("not_configured") ||
    (databaseStatus !== "connected" && data.database?.message?.toLowerCase().includes("database"))
  ) {
    return "database-unavailable";
  }

  return "degraded";
}

export function classifyHealthFailure(error: unknown, online: boolean): SystemHealthState {
  if (error instanceof Error && error.name === "AbortError") {
    return "timeout";
  }

  if (!online) {
    return "offline";
  }

  return "backend-unavailable";
}

function isConfigurationReady(data: HealthCheckData) {
  return (
    data.configuration?.databaseUrlLoaded === true && data.configuration?.jwtSecretLoaded === true
  );
}
