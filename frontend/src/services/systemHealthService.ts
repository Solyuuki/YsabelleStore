import { apiClient } from "@/services/apiClient";

export type SystemHealthState =
  | "checking"
  | "healthy"
  | "warning"
  | "database-unavailable"
  | "offline";

type HealthCheckData = {
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
      return "warning";
    }

    return classifyHealthResponse(response.data);
  } catch {
    return "offline";
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function classifyHealthResponse(data: HealthCheckData): SystemHealthState {
  const databaseStatus = data.checks?.database?.toLowerCase() ?? "";
  const status = data.status?.toLowerCase() ?? "";

  if (databaseStatus === "connected" && isConfigurationReady(data)) {
    return "healthy";
  }

  if (
    databaseStatus.includes("unavailable") ||
    databaseStatus.includes("not_configured") ||
    (databaseStatus !== "connected" && data.database?.message?.toLowerCase().includes("database"))
  ) {
    return "database-unavailable";
  }

  if (status.includes("degraded") || status.includes("warning")) {
    return "warning";
  }

  return "warning";
}

function isConfigurationReady(data: HealthCheckData) {
  return (
    data.configuration?.databaseUrlLoaded === true && data.configuration?.jwtSecretLoaded === true
  );
}
