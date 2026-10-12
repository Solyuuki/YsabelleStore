import { frontendEnv } from "@/schemas/frontendEnv.schema";

const apiBaseUrl = new URL(frontendEnv.VITE_API_BASE_URL);

apiBaseUrl.hash = "";
apiBaseUrl.search = "";
apiBaseUrl.pathname = apiBaseUrl.pathname.replace(/\/+$/, "") || "/";

export const frontendRuntimeConfig = Object.freeze({
  // In mobile preview, use the LAN Vite origin so the browser never calls its own localhost.
  apiBaseUrl:
    import.meta.env?.DEV &&
    import.meta.env?.VITE_MOBILE_PREVIEW === "1" &&
    typeof window !== "undefined"
      ? window.location.origin
      : apiBaseUrl.toString().replace(/\/$/, ""),
  appName: frontendEnv.VITE_APP_NAME,
  appVersion: frontendEnv.VITE_APP_VERSION
});

export function resolveApiUrl(path: string): URL {
  return new URL(path, `${frontendRuntimeConfig.apiBaseUrl}/`);
}
