import { apiClient } from "@/services/apiClient";
import type { StorefrontPagination } from "@/types/storefront";

export type CustomerModerationAccountStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "BANNED";

export type CustomerModerationSummary = {
  total: number;
  active: number;
  inactive: number;
  suspended: number;
  banned: number;
  restricted: number;
};

export type CustomerModerationAccount = {
  id: string;
  name: string;
  username: string | null;
  email: string;
  phone: string | null;
  status: CustomerModerationAccountStatus;
  createdAt: string;
  updatedAt: string;
  counts: {
    favorites: number;
    orders: number;
    reviews: number;
    activeSessions: number;
  };
};

export type CustomerModerationReview = {
  id: string;
  rating: number;
  comment: string;
  reviewerDisplayName: string;
  status: "VISIBLE" | "HIDDEN" | "REMOVED";
  moderationReason: string | null;
  moderatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  verifiedPurchase: boolean;
  product: {
    id: string;
    name: string;
    sku: string;
  };
  customerAccount: {
    id: string;
    name: string;
    email: string;
    status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "BANNED";
  } | null;
  moderatedBy: {
    id: string;
    name: string;
  } | null;
};

export type CustomerModerationAuditEntry = {
  id: string;
  action: string;
  reason: string;
  previousState: string | null;
  nextState: string | null;
  createdAt: string;
  productReviewId: string | null;
  actor: {
    id: string;
    name: string;
  };
};

function queryString(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params.toString();
}

export async function fetchCustomerModerationAccounts(
  query: {
    search?: string;
    status?: CustomerModerationAccountStatus;
    page?: number;
    pageSize?: number;
  } = {}
) {
  const search = queryString(query);
  const response = await apiClient.request<
    CustomerModerationAccount[],
    unknown,
    StorefrontPagination
  >(`/api/customer-admin/accounts${search ? `?${search}` : ""}`);
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

export async function fetchCustomerModerationSummary() {
  const response = await apiClient.request<CustomerModerationSummary>(
    "/api/customer-admin/accounts/summary"
  );
  if (!response.success || !response.data) throw new Error(response.message);
  return response.data;
}

export async function updateCustomerModerationAccount(
  id: string,
  input: { status: "ACTIVE" | "SUSPENDED" | "BANNED"; reason: string }
) {
  const response = await apiClient.request<{
    id: string;
    status: CustomerModerationAccount["status"];
  }>(`/api/customer-admin/accounts/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    json: input
  });
  if (!response.success || !response.data) throw new Error(response.message);
  return response.data;
}

export async function fetchCustomerModerationReviews(
  query: {
    search?: string;
    status?: "VISIBLE" | "HIDDEN" | "REMOVED";
    page?: number;
    pageSize?: number;
  } = {}
) {
  const search = queryString(query);
  const response = await apiClient.request<
    CustomerModerationReview[],
    unknown,
    StorefrontPagination
  >(`/api/customer-admin/reviews${search ? `?${search}` : ""}`);
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

export async function updateCustomerModerationReview(
  id: string,
  input: { status: "VISIBLE" | "HIDDEN" | "REMOVED"; reason: string }
) {
  const response = await apiClient.request<{
    id: string;
    status: CustomerModerationReview["status"];
  }>(`/api/customer-admin/reviews/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    json: input
  });
  if (!response.success || !response.data) throw new Error(response.message);
  return response.data;
}

export async function fetchCustomerModerationAudit(id: string) {
  const response = await apiClient.request<CustomerModerationAuditEntry[]>(
    `/api/customer-admin/accounts/${encodeURIComponent(id)}/audit`
  );
  if (!response.success || !response.data) throw new Error(response.message);
  return response.data;
}
