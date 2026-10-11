export const CUSTOMER_SUPPORT_CATEGORIES = [
  "ORDER",
  "PAYMENT",
  "PRODUCT",
  "PICKUP_DELIVERY",
  "ACCOUNT",
  "RETURN_REFUND",
  "FEEDBACK",
  "OTHER"
] as const;

export type CustomerSupportCategory = (typeof CUSTOMER_SUPPORT_CATEGORIES)[number];

export type CustomerSupportTicketCreateInput = {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  category: CustomerSupportCategory;
  orderNumber?: string;
  subject: string;
  message: string;
};

export type CustomerSupportTicketCreated = {
  id: string;
  ticketNumber: string;
  category: CustomerSupportCategory;
  status: "NEW" | "OPEN" | "WAITING_FOR_CUSTOMER" | "RESOLVED" | "CLOSED";
  subject: string;
  createdAt: string;
};
