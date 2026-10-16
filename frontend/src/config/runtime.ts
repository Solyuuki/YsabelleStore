import { frontendEnv } from "@/schemas/frontendEnv.schema";

const apiBaseUrl = new URL(frontendEnv.VITE_API_BASE_URL);

apiBaseUrl.hash = "";
apiBaseUrl.search = "";
apiBaseUrl.pathname = apiBaseUrl.pathname.replace(/\/+$/, "") || "/";

// Browser storefront production and LAN mobile preview must send auth cookies to
// their own origin, not to a cross-site backend domain.
const useFirstPartyApi =
  typeof window !== "undefined" &&
  (import.meta.env?.VITE_RAILWAY_FIRST_PARTY_API === "1" ||
    (import.meta.env?.DEV && import.meta.env?.VITE_MOBILE_PREVIEW === "1"));

export const frontendRuntimeConfig = Object.freeze({
  apiBaseUrl: useFirstPartyApi ? window.location.origin : apiBaseUrl.toString().replace(/\/$/, ""),
  appName: frontendEnv.VITE_APP_NAME,
  appVersion: frontendEnv.VITE_APP_VERSION
});

export function resolveApiUrl(path: string): URL {
  return new URL(path, `${frontendRuntimeConfig.apiBaseUrl}/`);
}
