import type { Customer } from "@/types/customerAuth";

export type CustomerSessionSummary = {
  id: string;
  current: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
};

export type CustomerProfileUpdateInput = {
  name: string;
};

export type CustomerUsernameClaimInput = {
  username: string;
  currentPassword: string;
};

export type CustomerPasswordChangeInput = {
  currentPassword: string;
  newPassword: string;
};

export type CustomerAccountCustomerResponse = {
  customer: Customer;
};

export type CustomerSessionsResponse = {
  sessions: CustomerSessionSummary[];
};

export type CustomerSessionRevocationResponse = {
  revokedCount: number;
};
