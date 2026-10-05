export const STAFF_SUPPORT_STATUSES = [
  "NEW",
  "OPEN",
  "WAITING_FOR_CUSTOMER",
  "RESOLVED",
  "CLOSED"
] as const;

export type StaffSupportStatus = (typeof STAFF_SUPPORT_STATUSES)[number];

export const STAFF_SUPPORT_CATEGORIES = [
  "ORDER",
  "PAYMENT",
  "PRODUCT",
  "PICKUP_DELIVERY",
  "ACCOUNT",
  "RETURN_REFUND",
  "FEEDBACK",
  "OTHER"
] as const;

export type StaffSupportCategory = (typeof STAFF_SUPPORT_CATEGORIES)[number];

export type StaffSupportTicketSummary = {
  id: string;
  ticketNumber: string;
  customerName: string;
  customerEmail: string;
  category: StaffSupportCategory;
  subject: string;
  status: StaffSupportStatus;
  lastMessageAt: string;
  lastCustomerMessageAt: string | null;
  lastStaffMessageAt: string | null;
  createdAt: string;
  customerOrder: {
    orderNumber: string;
  } | null;
  messageCount: number;
};

export type StaffSupportMessage = {
  id: string;
  senderType: "CUSTOMER" | "STAFF" | "SYSTEM";
  channel: "WEB" | "EMAIL" | "SYSTEM";
  senderUserId: string | null;
  senderName: string | null;
  senderEmail: string | null;
  body: string;
  deliveryStatus: "NOT_APPLICABLE" | "PENDING" | "SENT" | "FAILED";
  deliveryError: string | null;
  gmailMessageId: string | null;
  gmailThreadId: string | null;
  emailSentAt: string | null;
  createdAt: string;
  senderUser: {
    id: string;
    name: string;
    email: string;
  } | null;
};

export type StaffSupportTicketDetail = {
  id: string;
  ticketNumber: string;
  customerAccountId: string | null;
  customerOrderId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  category: StaffSupportCategory;
  subject: string;
  status: StaffSupportStatus;
  lastMessageAt: string;
  lastCustomerMessageAt: string | null;
  lastStaffMessageAt: string | null;
  lastReadByStaffAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  customerAccount: {
    id: string;
    name: string;
    email: string;
    status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "BANNED";
  } | null;
  customerOrder: {
    id: string;
    orderNumber: string;
    status: string;
  } | null;
  messages: StaffSupportMessage[];
};

export type SupportGmailStatus = {
  configured: boolean;
  mailbox: string | null;
};

export type SupportGmailSyncResult = {
  imported: number;
  skipped: number;
};
