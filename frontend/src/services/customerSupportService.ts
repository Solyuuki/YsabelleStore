import { apiClient } from "@/services/apiClient";
import type {
  CustomerSupportTicketCreateInput,
  CustomerSupportTicketCreated
} from "@/types/customerSupport";

export async function submitCustomerSupportTicket(input: CustomerSupportTicketCreateInput) {
  const response = await apiClient.request<CustomerSupportTicketCreated, unknown>(
    "/api/customer-support/tickets",
    {
      method: "POST",
      credentials: "include",
      json: input
    }
  );

  if (!response.success || !response.data) {
    throw new Error(response.message || "Your support request could not be submitted.");
  }

  return response.data;
}
