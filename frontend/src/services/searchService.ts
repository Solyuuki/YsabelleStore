import { apiClient } from "@/services/apiClient";
import type { ApiResponse } from "@/types/api";
import type { SearchResponseData } from "@/types/search";

type SearchErrorPayload = {
  code?: string;
  details?: unknown;
};

const AUTH_TOKEN_KEY = "ysabellestore.authToken";

export async function searchSystem(
  query: string,
  options: { signal?: AbortSignal } = {}
): Promise<ApiResponse<SearchResponseData, SearchErrorPayload>> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const searchParams = new URLSearchParams({
    q: query.trim()
  });

  return apiClient.request<SearchResponseData, SearchErrorPayload>(`/api/search?${searchParams}`, {
    headers: token
      ? {
          Authorization: `Bearer ${token}`
        }
      : undefined,
    signal: options.signal
  });
}
