import type { RestockOwnerWarning } from "@/services/restockApi";

const warningLabels: Record<string, string> = {
  POS_HISTORY_UNVERIFIED: "Recent POS sales history is insufficient for a reliable recommendation.",
  TARGET_POLICY_UNVERIFIED: "The suggested target-stock level has not been independently approved.",
  INVALID_STOCK_POSITION: "Available or incoming stock information needs review.",
  COST_UNAVAILABLE: "The product has no reliable unit cost; purchase cost is unknown.",
  ABSOLUTE_UNIT_LIMIT_EXCEEDED: "The quantity exceeds the automation-only unit ceiling.",
  COVERAGE_LIMIT_EXCEEDED: "The quantity exceeds the conservative demand-coverage suggestion.",
  LINE_BUDGET_EXCEEDED: "The estimated product cost exceeds the advisory budget.",
  ORDER_BUDGET_EXCEEDED: "The estimated total cost exceeds the advisory order budget.",
  CURRENT_DEMAND_DATA_UNAVAILABLE: "Current demand data is unavailable for this product.",
  INVALID_QUANTITY: "The suggested automated purchase quantity needs review."
};

export function RestockOwnerWarnings({
  warnings,
  onApplySuggestedQuantity
}: {
  warnings: RestockOwnerWarning[];
  onApplySuggestedQuantity?: (productId: string, quantity: number) => void;
}) {
  if (warnings.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-500/60 dark:bg-amber-950/40 dark:text-amber-100"
      role="alert"
    >
      <p className="text-sm font-semibold">Purchasing advice — Owner decision</p>
      <p className="mt-1 text-xs leading-5">
        These are recommendations, not purchase restrictions. You may keep your requested quantities
        and confirm the order. Your acknowledgment will be recorded.
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5">
        {warnings.map((warning, index) => (
          <li key={`${warning.productId ?? "order"}-${warning.reason}-${index}`}>
            {warningLabels[warning.reason] ?? warning.reason}
            {warning.productId ? ` (Product: ${warning.productId})` : ""}
            {warning.requestedQuantity !== null
              ? ` Requested: ${warning.requestedQuantity.toLocaleString()} units.`
              : ""}
            {warning.suggestedQuantity !== null
              ? ` System suggests: ${warning.suggestedQuantity.toLocaleString()} units.`
              : ""}
            {onApplySuggestedQuantity &&
            warning.productId &&
            warning.suggestedQuantity !== null &&
            Number.isSafeInteger(warning.suggestedQuantity) &&
            warning.suggestedQuantity > 0 ? (
              <button
                className="ml-2 rounded border border-amber-600 px-2 py-1 font-semibold text-amber-900 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 dark:border-amber-300 dark:text-amber-100"
                onClick={() =>
                  onApplySuggestedQuantity(warning.productId!, warning.suggestedQuantity!)
                }
                type="button"
              >
                Use suggested quantity
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
