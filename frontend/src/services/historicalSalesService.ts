import { frontendEnv } from "@/schemas/frontendEnv.schema";
import { apiClient } from "@/services/apiClient";
import { getStoredAuthToken } from "@/services/authStorage";
import type {
  EligibilityResponse,
  HistoricalSalesAuditRow,
  HistoricalSalesBatch,
  HistoricalSalesImportMode,
  HistoricalSalesPreview,
  Paginated,
  RollbackImpact
} from "@/types/historicalSales";

function query(page: number, pageSize: number, status?: string) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (status) params.set("status", status);
  return params.toString();
}

export function previewHistoricalSales(file: File) {
  const formData = new FormData();
  formData.set("file", file);
  return apiClient.request<HistoricalSalesPreview>("/api/historical-sales/preview", {
    formData,
    method: "POST"
  });
}

export function confirmHistoricalSales(
  file: File,
  previewBatchId: string,
  importMode: HistoricalSalesImportMode
) {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("previewBatchId", previewBatchId);
  formData.set("importMode", importMode);
  return apiClient.request<HistoricalSalesBatch>("/api/historical-sales/confirm", {
    formData,
    method: "POST"
  });
}

export function listHistoricalSalesBatches(page: number, pageSize: number, signal?: AbortSignal) {
  return apiClient.request<Paginated<HistoricalSalesBatch>>(
    `/api/historical-sales/batches?${query(page, pageSize)}`,
    { signal }
  );
}

export function getHistoricalSalesBatch(batchId: string, signal?: AbortSignal) {
  return apiClient.request<HistoricalSalesBatch>(
    `/api/historical-sales/batches/${encodeURIComponent(batchId)}`,
    { signal }
  );
}

export function listHistoricalSalesRows(
  batchId: string,
  page: number,
  pageSize: number,
  status?: string,
  signal?: AbortSignal
) {
  return apiClient.request<Paginated<HistoricalSalesAuditRow>>(
    `/api/historical-sales/batches/${encodeURIComponent(batchId)}/rows?${query(page, pageSize, status)}`,
    { signal }
  );
}

export function getHistoricalSalesEligibility(
  page: number,
  pageSize: number,
  signal?: AbortSignal
) {
  return apiClient.request<EligibilityResponse>(
    `/api/historical-sales/eligibility?${query(page, pageSize)}`,
    { signal }
  );
}

export function previewHistoricalSalesRollback(batchId: string, signal?: AbortSignal) {
  return apiClient.request<RollbackImpact>(
    `/api/historical-sales/batches/${encodeURIComponent(batchId)}/rollback-impact`,
    { signal }
  );
}

export function rollbackHistoricalSales(batchId: string, reason: string, signal?: AbortSignal) {
  return apiClient.request<HistoricalSalesBatch>(
    `/api/historical-sales/batches/${encodeURIComponent(batchId)}/rollback`,
    { json: { reason }, method: "POST", signal }
  );
}

export function refreshHistoricalSalesForecasts(batchId: string, signal?: AbortSignal) {
  return apiClient.request(
    `/api/historical-sales/batches/${encodeURIComponent(batchId)}/refresh-forecasts`,
    { json: {}, method: "POST", signal }
  );
}

export async function downloadHistoricalSalesTemplate() {
  const response = await fetch(
    new URL("/api/historical-sales/template", frontendEnv.VITE_API_BASE_URL),
    {
      headers: getStoredAuthToken()
        ? { Authorization: `Bearer ${getStoredAuthToken()}` }
        : undefined
    }
  );
  if (!response.ok) throw new Error("Historical sales template download failed.");
  return await response.text();
}
