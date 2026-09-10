import { apiClient } from "@/services/apiClient";
import type { InventoryMutationResult } from "@/services/catalogApi";

export type ReceivingStockInput = {
  quantity: number;
  batchCode: string;
  expiresAt?: string | null;
  scannedBarcode?: string;
  confirmNewBarcode?: boolean;
};

export type ReceivingBarcodeErrorDetails = {
  barcode?: string;
  productId?: string;
  productName?: string;
  productSku?: string;
  existingProductId?: string;
  existingProductName?: string;
  existingProductSku?: string;
  requestedProductId?: string;
};

export type ReceivingApiError = {
  code?: string;
  details?: ReceivingBarcodeErrorDetails;
};

export function receiveInventoryStock(productId: string, input: ReceivingStockInput) {
  return apiClient.request<InventoryMutationResult, ReceivingApiError>(
    `/api/inventory/${encodeURIComponent(productId)}/stock-in`,
    {
      method: "POST",
      json: input
    }
  );
}
