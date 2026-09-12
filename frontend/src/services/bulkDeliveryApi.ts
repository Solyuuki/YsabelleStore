import { apiClient } from "@/services/apiClient";

export type BulkDeliverySourceType = "SPREADSHEET" | "PDF" | "MANUAL";

export type BulkDeliveryLineInput = {
  productId: string;
  receivedQuantity: number;
  batchCode: string;
  expiresAt: string | null;
  noExpiration: boolean;
  reason?: string | null;
};

export type BulkDeliverySessionResult = {
  sessionId: string;
  sourceType: BulkDeliverySourceType;
  sourceFileName: string | null;
  totalLines: number;
  totalUnitsReceived: number;
  productCount: number;
  completedAt: string;
  rows: Array<{
    productId: string;
    receivedQuantity: number;
    batchCode: string;
    expiresAt: string | null;
    movementId: string;
  }>;
};

export async function completeBulkDeliverySession(input: {
  sourceType: BulkDeliverySourceType;
  sourceFileName?: string | null;
  rows: BulkDeliveryLineInput[];
}) {
  const response = await apiClient.request<
    BulkDeliverySessionResult,
    { code?: string; details?: unknown }
  >("/api/inventory/delivery-sessions/complete", {
    method: "POST",
    json: input
  });

  if (!response.success || !response.data) {
    throw new Error(response.message);
  }

  return response.data;
}
