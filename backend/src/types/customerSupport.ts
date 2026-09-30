export const SUPPORT_TICKET_STATUSES = [
  "NEW",
  "OPEN",
  "WAITING_FOR_CUSTOMER",
  "RESOLVED",
  "CLOSED"
] as const;

export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];

export const SUPPORT_TICKET_CATEGORIES = [
  "ORDER",
  "PAYMENT",
  "PRODUCT",
  "PICKUP_DELIVERY",
  "ACCOUNT",
  "RETURN_REFUND",
  "FEEDBACK",
  "OTHER"
] as const;

export type SupportTicketCategory = (typeof SUPPORT_TICKET_CATEGORIES)[number];

export const SUPPORT_MESSAGE_SENDER_TYPES = ["CUSTOMER", "STAFF", "SYSTEM"] as const;

export type SupportMessageSenderType = (typeof SUPPORT_MESSAGE_SENDER_TYPES)[number];

export const SUPPORT_MESSAGE_CHANNELS = ["WEB", "EMAIL", "SYSTEM"] as const;

export type SupportMessageChannel = (typeof SUPPORT_MESSAGE_CHANNELS)[number];

export const SUPPORT_MESSAGE_DELIVERY_STATUSES = [
  "NOT_APPLICABLE",
  "PENDING",
  "SENT",
  "FAILED"
] as const;

export type SupportMessageDeliveryStatus = (typeof SUPPORT_MESSAGE_DELIVERY_STATUSES)[number];
