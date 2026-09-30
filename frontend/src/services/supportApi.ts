import { apiClient } from "@/services/apiClient";
import type {
  StaffSupportCategory,
  StaffSupportStatus,
  StaffSupportTicketDetail,
  StaffSupportTicketSummary
} from "@/types/staffSupport";
import type { StorefrontPagination } from "@/types/storefront";

function queryString(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params.toString();
}

export async function fetchStaffSupportTickets(
  query: {
    status?: StaffSupportStatus;
    category?: StaffSupportCategory;
    search?: string;
    page?: number;
    pageSize?: number;
  } = {},
  signal?: AbortSignal
) {
  const search = queryString(query);
  const response = await apiClient.request<
    StaffSupportTicketSummary[],
    unknown,
    StorefrontPagination
  >(`/api/support/tickets${search ? `?${search}` : ""}`, { signal });

  if (!response.success || !response.data) throw new Error(response.message);

  return {
    items: response.data,
    meta: response.meta ?? {
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 25,
      totalItems: response.data.length,
      totalPages: 1
    }
  };
}

export async function fetchStaffSupportTicket(ticketId: string, signal?: AbortSignal) {
  const response = await apiClient.request<StaffSupportTicketDetail>(
    `/api/support/tickets/${encodeURIComponent(ticketId)}`,
    { signal }
  );

  if (!response.success || !response.data) throw new Error(response.message);
  return response.data;
}

export async function replyToStaffSupportTicket(ticketId: string, message: string) {
  const response = await apiClient.request<StaffSupportTicketDetail>(
    `/api/support/tickets/${encodeURIComponent(ticketId)}/replies`,
    {
      method: "POST",
      json: { message }
    }
  );

  if (!response.success || !response.data) throw new Error(response.message);
  return response.data;
}

export async function updateStaffSupportTicketStatus(ticketId: string, status: StaffSupportStatus) {
  const response = await apiClient.request<StaffSupportTicketDetail>(
    `/api/support/tickets/${encodeURIComponent(ticketId)}/status`,
    {
      method: "PATCH",
      json: { status }
    }
  );

  if (!response.success || !response.data) throw new Error(response.message);
  return response.data;
}


export async function fetchSupportGmailStatus() {
  const response = await apiClient.request<import("@/types/staffSupport").SupportGmailStatus>(
    "/api/support/gmail/status"
  );
  if (!response.success || !response.data) throw new Error(response.message);
  return response.data;
}

export async function syncSupportGmail() {
  const response = await apiClient.request<import("@/types/staffSupport").SupportGmailSyncResult>(
    "/api/support/gmail/sync",
    { method: "POST" }
  );
  if (!response.success || !response.data) throw new Error(response.message);
  return response.data;
}

export async function retryStaffSupportMessageEmail(ticketId: string, messageId: string) {
  const response = await apiClient.request<StaffSupportTicketDetail>(
    `/api/support/tickets/${encodeURIComponent(ticketId)}/messages/${encodeURIComponent(messageId)}/retry-email`,
    { method: "POST" }
  );
  if (!response.success || !response.data) throw new Error(response.message);
  return response.data;
}
