import { apiClient } from "@/services/apiClient";
import type { RestockOrderStatus } from "@/services/restockApi";

export type BulkDeliverySourceType = "SPREADSHEET" | "PDF" | "MANUAL";

export type BulkDeliveryLineInput = {
  productId: string;
  restockOrderLineId?: string | null;
  receivedQuantity: number;
  damagedQuantity?: number;
  damageReason?: string | null;
  acceptedQuantity?: number;
  batchCode?: string | null;
  expiresAt: string | null;
  noExpiration: boolean;
  confirmOverDelivery?: boolean;
  reason?: string | null;
};

export type BulkDeliverySessionResult = {
  sessionId: string;
  sourceType: BulkDeliverySourceType;
  sourceFileName: string | null;
  restockOrderId: string | null;
  restockOrderNumber: string | null;
  restockOrderStatus: RestockOrderStatus | null;
  restockOrderVersion: number | null;
  totalLines: number;
  totalUnitsDelivered: number;
  totalUnitsReceived: number;
  totalUnitsAccepted: number;
  totalUnitsDamaged: number;
  totalUnitsRejected: number;
  remainingUnits: number;
  productCount: number;
  requiresReturnReport: boolean;
  completedAt: string;
  rows: Array<{
    productId: string;
    restockOrderLineId: string | null;
    receivedQuantity: number;
    acceptedQuantity: number;
    damagedQuantity: number;
    batchCode: string | null;
    expiresAt: string | null;
    movementId: string | null;
  }>;
};

export async function completeBulkDeliverySession(input: {
  sourceType: BulkDeliverySourceType;
  sourceFileName?: string | null;
  restockOrderId?: string | null;
  expectedOrderVersion?: number;
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
