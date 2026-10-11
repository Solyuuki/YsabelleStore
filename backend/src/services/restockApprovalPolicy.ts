import { RESTOCK_SAFETY_ABSOLUTE_MAX_LINE_UNITS } from "./restockProcurementSafety.js";
import { requiresAutomatedQuantityReview } from "./restockDraftReconciliation.js";

export type RestockApprovalWarning = {
  productId: string | null;
  reason: string;
  requestedQuantity: number | null;
  suggestedQuantity: number | null;
};

export type RestockLineIntegrity = {
  isSelected: boolean;
  productId: string;
  recommendationSource: "SARIMA" | "LOW_STOCK" | "TARGET_STOCK" | "MANUAL";
  recommendedQuantity: number;
  requestedQuantity: number;
  receivedQuantity: number;
  ownerOverrideReason: string | null;
};

/** Only system-created monthly plans are subjected to strict procurement ceilings. */
export function isAutomatedMonthlyOrder(notes: string | null) {
  return Boolean(
    notes?.includes("[AutomatedRestockMonth:") || notes?.includes("[AutomatedRestock:")
  );
}

/**
 * Frozen monthly recommendations must be valid without consulting live POS data.
 * Historical inflated automated tickets remain quarantined during approval,
 * shipment transition and every subsequent receipt. Manual Owner orders never
 * pass through this purchasing-quantity gate.
 */
export function findInflatedAutomatedLine(
  notes: string | null,
  lines: readonly RestockLineIntegrity[]
): { productId: string; reason: string } | null {
  if (!isAutomatedMonthlyOrder(notes)) return null;
  for (const line of lines) {
    if (!line.isSelected) continue;
    if (
      !Number.isSafeInteger(line.requestedQuantity) ||
      !Number.isSafeInteger(line.recommendedQuantity) ||
      !Number.isSafeInteger(line.receivedQuantity) ||
      line.requestedQuantity < 1 ||
      line.recommendedQuantity < 0 ||
      line.receivedQuantity < 0 ||
      line.receivedQuantity > line.requestedQuantity ||
      (line.recommendationSource !== "MANUAL" &&
        (line.recommendedQuantity < 1 ||
          line.recommendedQuantity > RESTOCK_SAFETY_ABSOLUTE_MAX_LINE_UNITS ||
          line.requestedQuantity > RESTOCK_SAFETY_ABSOLUTE_MAX_LINE_UNITS))
    ) {
      return { productId: line.productId, reason: "AUTOMATED_QUANTITY_OUT_OF_BOUNDS" };
    }
    if (
      line.recommendationSource !== "MANUAL" &&
      line.requestedQuantity > line.recommendedQuantity &&
      requiresAutomatedQuantityReview(
        line.requestedQuantity,
        line.recommendedQuantity,
        line.ownerOverrideReason
      )
    ) {
      return { productId: line.productId, reason: "AUTOMATED_REQUEST_EXCEEDS_SAVED_BASELINE" };
    }
  }
  return null;
}
