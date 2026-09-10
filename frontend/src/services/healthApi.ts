import { apiClient } from "@/services/apiClient";

export type BackendHealth = {
  service: string;
  status: "healthy" | "degraded" | "unavailable";
  ready: boolean;
  environment: string;
  port: number;
  configuration: {
    databaseUrlLoaded: boolean;
    jwtSecretLoaded: boolean;
  };
  checks: {
    database: string;
    prisma: string;
  };
  database: {
    message: string;
  };
};

export async function fetchBackendReadiness() {
  const response = await apiClient.request<BackendHealth, never>("/api/health/ready");

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return response.data;
}
