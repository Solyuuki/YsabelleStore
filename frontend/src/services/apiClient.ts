import { frontendEnv } from "@/schemas/frontendEnv.schema";

export const apiClientConfig = {
  baseUrl: frontendEnv.VITE_API_BASE_URL
} as const;
