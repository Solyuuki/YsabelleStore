import type { RestockRecommendationSource } from "@prisma/client";

export type ExistingDraftRestockLine = {
  isSelected: boolean;
  ownerOverrideReason: string | null;
  recommendationId: string | null;
  recommendationSource: RestockRecommendationSource;
  recommendedQuantity: number;
  requestedQuantity: number;
};

export type DraftRestockAction = {
  quantity: number;
  recommendationId: string | null;
  recommendationSource: RestockRecommendationSource;
};

export function reconcileDraftRestockLine(
  existing: ExistingDraftRestockLine,
  action: DraftRestockAction
) {
  // Owner-created/manual rows are never taken over by the automatic worker.
  if (existing.recommendationSource === "MANUAL") return null;

  const ownerAdjusted =
    !existing.isSelected ||
    Boolean(existing.ownerOverrideReason?.trim()) ||
    existing.requestedQuantity !== existing.recommendedQuantity;

  const next = {
    recommendationId: action.recommendationId,
    recommendationSource: action.recommendationSource,
    recommendedQuantity: action.quantity,
    requestedQuantity: ownerAdjusted ? existing.requestedQuantity : action.quantity
  };

  if (
    next.recommendationId === existing.recommendationId &&
    next.recommendationSource === existing.recommendationSource &&
    next.recommendedQuantity === existing.recommendedQuantity &&
    next.requestedQuantity === existing.requestedQuantity
  ) {
    return null;
  }

  return next;
}

/**
 * A suspicious automated purchase order must not become an approved incoming
 * shipment just because a broken draft accumulated repeated recommendations.
 * Owner override reasons are audit evidence, NEVER an exception to hard limits.
 */
export function requiresAutomatedQuantityReview(
  requestedQuantity: number,
  latestRecommendedQuantity: number,
  ownerOverrideReason: string | null
) {
  // Reasons document intent; they never disable anomaly checks.
  void ownerOverrideReason;

  const baseline = Math.max(0, Math.ceil(latestRecommendedQuantity));
  const reviewThreshold = Math.max(baseline + 10, Math.ceil(baseline * 1.5));
  return requestedQuantity > reviewThreshold;
}
