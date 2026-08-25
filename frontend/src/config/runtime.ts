import { frontendEnv } from "@/schemas/frontendEnv.schema";

const apiBaseUrl = new URL(frontendEnv.VITE_API_BASE_URL);

apiBaseUrl.hash = "";
apiBaseUrl.search = "";
apiBaseUrl.pathname = apiBaseUrl.pathname.replace(/\/+$/, "") || "/";

export const frontendRuntimeConfig = Object.freeze({
  apiBaseUrl: apiBaseUrl.toString().replace(/\/$/, ""),
  appName: frontendEnv.VITE_APP_NAME,
  appVersion: frontendEnv.VITE_APP_VERSION
});

export function resolveApiUrl(path: string): URL {
  return new URL(path, `${frontendRuntimeConfig.apiBaseUrl}/`);
}
