export const AUTH_TOKEN_KEY = "ysabellestore.authToken";

export function getStoredAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}
