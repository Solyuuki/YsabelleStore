import { invalidateForecastCache } from "../modules/forecasting/forecast.service.js";

export type DomainChangeType =
  | "PRODUCT_CREATED"
  | "PRODUCT_UPDATED"
  | "TARGET_CHANGED"
  | "REORDER_LEVEL_CHANGED"
  | "STOCK_RECEIVED"
  | "STOCK_SOLD"
  | "STOCK_ADJUSTED"
  | "STOCK_EXPIRED"
  | "RESTOCK_APPROVED"
  | "RESTOCK_RECEIVED";

export type DomainChange = {
  type: DomainChangeType;
  productIds: string[];
};

export type DomainChangeEffects = {
  forecast: "NONE" | "AFFECTED_PRODUCTS";
  reports: "LIVE_READ";
  restockPlanning: "LIVE_READ";
};

/**
 * Sprint 10 Phase 5 propagation policy.
 *
 * Reports and restock planning read canonical database state on demand, so they stay
 * synchronized without a cache-busting side effect. SARIMA is different: only a sale
 * changes effective demand history and therefore marks the affected product forecast
 * dirty. Stock receipts, stock policy edits, image edits, and restock approval do not
 * refit historical demand.
 */
export function getDomainChangeEffects(type: DomainChangeType): DomainChangeEffects {
  return {
    forecast: type === "STOCK_SOLD" ? "AFFECTED_PRODUCTS" : "NONE",
    reports: "LIVE_READ",
    restockPlanning: "LIVE_READ"
  };
}

export function propagateDomainChange(change: DomainChange) {
  const productIds = [...new Set(change.productIds.filter(Boolean))];
  const effects = getDomainChangeEffects(change.type);

  if (effects.forecast === "AFFECTED_PRODUCTS" && productIds.length > 0) {
    invalidateForecastCache(productIds);
  }

  return {
    ...effects,
    productIds,
    type: change.type
  };
}
