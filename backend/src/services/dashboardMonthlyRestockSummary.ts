/**
 * Aggregate the full monthly action list, not the small Dashboard preview.
 * Purchase quantities are exclusive to RESTOCK actions; expiry and overstock
 * reviews remain visible but do not become implied supplier orders.
 */
export type MonthlyRestockSummaryAction = {
  actionType: "RESTOCK" | "REDUCE_REPLENISHMENT" | "EXPIRY_REVIEW";
  recommendedQuantity: number;
};

export function summarizeMonthlyRestockActions(
  actions: readonly MonthlyRestockSummaryAction[]
) {
  const restockProducts = actions.filter((action) => action.actionType === "RESTOCK").length;

  return {
    restockProducts,
    otherReviewProducts: actions.length - restockProducts,
    suggestedUnits: actions.reduce(
      (total, action) =>
        total + (action.actionType === "RESTOCK" ? Math.max(0, action.recommendedQuantity) : 0),
      0
    )
  };
}
