import { InventoryBatchStatus } from "@prisma/client";

export const STOCK_BUSINESS_TIME_ZONE = "Asia/Manila";
export const NEAR_EXPIRY_WINDOW_DAYS = 30;
export const CRITICAL_EXPIRY_WINDOW_DAYS = 7;

const MILLISECONDS_PER_DAY = 86_400_000;
const businessDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: STOCK_BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

export type StockBatchLike = {
  id?: string;
  batchCode?: string;
  expiresAt: Date | null;
  quantityRemaining: number;
  status: InventoryBatchStatus;
};

export type InventoryBatchLifecycleStatus =
  | "NO_EXPIRY"
  | "AVAILABLE"
  | "NEAR_EXPIRY"
  | "CRITICAL_EXPIRY"
  | "EXPIRED"
  | "QUARANTINED"
  | "DEPLETED"
  | "REMOVED";

export type StockTruth = {
  physicalOnHand: number;
  sellableStock: number;
  expiredStock: number;
  quarantinedStock: number;
  incomingStock: number;
  batchCount: number;
  sellableBatchCount: number;
  nearestExpiry: Date | null;
  nearestExpiryQuantity: number;
  nearestExpiryDays: number | null;
};

function businessDaySerial(value: Date) {
  const parts = businessDateFormatter.formatToParts(value);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? 0);
  const month = Number(parts.find((part) => part.type === "month")?.value ?? 0);
  const day = Number(parts.find((part) => part.type === "day")?.value ?? 0);

  return Math.floor(Date.UTC(year, month - 1, day) / MILLISECONDS_PER_DAY);
}

function expirationDaySerial(value: Date) {
  return Math.floor(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()) /
      MILLISECONDS_PER_DAY
  );
}

export function getDaysUntilExpiry(expiresAt: Date, now?: Date): number;
export function getDaysUntilExpiry(expiresAt: null, now?: Date): null;
export function getDaysUntilExpiry(expiresAt: Date | null, now?: Date): number | null;
export function getDaysUntilExpiry(expiresAt: Date | null, now = new Date()) {
  if (!expiresAt) return null;
  return expirationDaySerial(expiresAt) - businessDaySerial(now);
}

export function isBatchSellable(batch: StockBatchLike, now = new Date()) {
  if (batch.quantityRemaining <= 0) return false;
  if (
    batch.status !== InventoryBatchStatus.AVAILABLE &&
    batch.status !== InventoryBatchStatus.LOW_STOCK
  ) {
    return false;
  }

  const daysUntilExpiry = getDaysUntilExpiry(batch.expiresAt, now);
  return daysUntilExpiry === null || daysUntilExpiry >= 0;
}

export function getBatchLifecycleStatus(
  batch: StockBatchLike,
  now = new Date()
): InventoryBatchLifecycleStatus {
  if (batch.status === InventoryBatchStatus.REMOVED) return "REMOVED";
  if (batch.quantityRemaining <= 0 || batch.status === InventoryBatchStatus.DEPLETED) {
    return "DEPLETED";
  }

  const daysUntilExpiry = getDaysUntilExpiry(batch.expiresAt, now);

  if (
    batch.status === InventoryBatchStatus.EXPIRED ||
    (daysUntilExpiry !== null && daysUntilExpiry < 0)
  ) {
    return "EXPIRED";
  }

  if (!isBatchSellable(batch, now)) return "QUARANTINED";
  if (daysUntilExpiry === null) return "NO_EXPIRY";
  if (daysUntilExpiry <= CRITICAL_EXPIRY_WINDOW_DAYS) return "CRITICAL_EXPIRY";
  if (daysUntilExpiry <= NEAR_EXPIRY_WINDOW_DAYS) return "NEAR_EXPIRY";
  return "AVAILABLE";
}

export function calculateStockTruth(batches: StockBatchLike[], now = new Date()): StockTruth {
  let physicalOnHand = 0;
  let sellableStock = 0;
  let expiredStock = 0;
  let quarantinedStock = 0;
  let batchCount = 0;
  let sellableBatchCount = 0;
  let nearestExpiry: Date | null = null;
  let nearestExpiryDays: number | null = null;
  let nearestExpiryQuantity = 0;

  for (const batch of batches) {
    const quantity = Math.max(0, batch.quantityRemaining);
    if (quantity <= 0) continue;

    physicalOnHand += quantity;
    batchCount += 1;

    const lifecycleStatus = getBatchLifecycleStatus(batch, now);
    const sellable = isBatchSellable(batch, now);

    if (lifecycleStatus === "EXPIRED") {
      expiredStock += quantity;
    }

    if (!sellable && lifecycleStatus !== "REMOVED" && lifecycleStatus !== "DEPLETED") {
      quarantinedStock += quantity;
    }

    if (!sellable) continue;

    sellableStock += quantity;
    sellableBatchCount += 1;

    if (!batch.expiresAt) continue;

    const daysUntilExpiry = getDaysUntilExpiry(batch.expiresAt, now);
    if (daysUntilExpiry === null) continue;

    if (nearestExpiryDays === null || daysUntilExpiry < nearestExpiryDays) {
      nearestExpiry = batch.expiresAt;
      nearestExpiryDays = daysUntilExpiry;
      nearestExpiryQuantity = quantity;
    } else if (daysUntilExpiry === nearestExpiryDays) {
      nearestExpiryQuantity += quantity;
    }
  }

  return {
    physicalOnHand,
    sellableStock,
    expiredStock,
    quarantinedStock,
    incomingStock: 0,
    batchCount,
    sellableBatchCount,
    nearestExpiry,
    nearestExpiryQuantity,
    nearestExpiryDays
  };
}
