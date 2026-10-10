/**
 * Independent, fail-closed procurement limits.
 *
 * These guards deliberately do not derive their ceiling from SARIMA output:
 * only completed POS sales, physical stock, incoming stock and trusted unit cost
 * may authorize a purchase. Defaults are conservative provisional limits until
 * store-specific lead-time and budget policies are approved.
 *
 * Pure functions: no persistence, no test fixtures, no database access.
 */
export const RESTOCK_SAFETY_MONTHS_OF_COVER = 3;
export const RESTOCK_SAFETY_ABSOLUTE_MAX_LINE_UNITS = 1_000;
export const RESTOCK_SAFETY_MAX_LINE_COST_PHP = 5_000;
export const RESTOCK_SAFETY_MAX_ORDER_COST_PHP = 20_000;

export type ProcurementSafetyInput = {
  requestedQuantity: number;
  monthlyPosDemand: number | null;
  posConfidence: "HIGH" | "MEDIUM" | "LOW";
  sellableStock: number;
  incomingStock: number;
  expiryRiskQuantity: number;
  unitCost: number | null;
  recommendationSource?: "SARIMA" | "LOW_STOCK" | "TARGET_STOCK" | "MANUAL";
  targetStockLevel?: number;
  approvedTargetStockLevel?: number | null;
  targetApprovalById?: string | null;
  targetApprovedAt?: Date | null;
};

export type ProcurementSafetyResult =
  | { safe: true; maxAllowedQuantity: number; lineCostPHP: number }
  | {
      safe: false;
      reason:
        | "INVALID_QUANTITY"
        | "POS_HISTORY_UNVERIFIED"
        | "TARGET_POLICY_UNVERIFIED"
        | "INVALID_STOCK_POSITION"
        | "COST_UNAVAILABLE"
        | "ABSOLUTE_UNIT_LIMIT_EXCEEDED"
        | "COVERAGE_LIMIT_EXCEEDED"
        | "LINE_BUDGET_EXCEEDED";
      maxAllowedQuantity: number | null;
      lineCostPHP: number | null;
    };

function validUnits(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validNonNegative(value: number) {
  return Number.isFinite(value) && value >= 0;
}

/** Any missing independent evidence denies purchase authorization. */
export function assessProcurementSafety(input: ProcurementSafetyInput): ProcurementSafetyResult {
  const reject = (
    reason: Extract<ProcurementSafetyResult, { safe: false }>["reason"],
    maxAllowedQuantity: number | null = null,
    lineCostPHP: number | null = null
  ): ProcurementSafetyResult => ({ safe: false, reason, maxAllowedQuantity, lineCostPHP });

  if (!validUnits(input.requestedQuantity) || input.requestedQuantity < 1) {
    return reject("INVALID_QUANTITY");
  }
  if (input.requestedQuantity > RESTOCK_SAFETY_ABSOLUTE_MAX_LINE_UNITS) {
    return reject("ABSOLUTE_UNIT_LIMIT_EXCEEDED", RESTOCK_SAFETY_ABSOLUTE_MAX_LINE_UNITS);
  }
  const posVerified =
    input.posConfidence !== "LOW" &&
    input.monthlyPosDemand !== null &&
    validNonNegative(input.monthlyPosDemand) &&
    input.monthlyPosDemand > 0;
  const explicitlyApprovedTarget =
    input.recommendationSource === "TARGET_STOCK" &&
    validUnits(input.targetStockLevel ?? NaN) &&
    (input.targetStockLevel ?? 0) > 0 &&
    input.approvedTargetStockLevel === input.targetStockLevel &&
    Boolean(input.targetApprovalById) &&
    input.targetApprovedAt instanceof Date &&
    Number.isFinite(input.targetApprovedAt.getTime());

  if (input.recommendationSource === "TARGET_STOCK" && !explicitlyApprovedTarget) {
    return reject("TARGET_POLICY_UNVERIFIED");
  }
  if (!posVerified && !explicitlyApprovedTarget) {
    return reject("POS_HISTORY_UNVERIFIED");
  }
  if (
    !validUnits(input.sellableStock) ||
    !validUnits(input.incomingStock) ||
    !validUnits(input.expiryRiskQuantity) ||
    input.expiryRiskQuantity > input.sellableStock
  ) {
    return reject("INVALID_STOCK_POSITION");
  }
  if (input.unitCost === null || !Number.isFinite(input.unitCost) || input.unitCost <= 0) {
    return reject("COST_UNAVAILABLE");
  }

  // Target-only fallback is allowed solely for an explicitly approved
  // current Owner target. Never use model output to establish a purchase cap.
  const independentDemandCeiling = input.recommendationSource === "TARGET_STOCK"
    ? Math.max(
        input.targetStockLevel ?? 0,
        posVerified ? RESTOCK_SAFETY_MONTHS_OF_COVER * input.monthlyPosDemand! : 0
      )
    : RESTOCK_SAFETY_MONTHS_OF_COVER * input.monthlyPosDemand!;
  const maxAllowedQuantity = Math.max(
    0,
    Math.ceil(
      independentDemandCeiling +
        input.expiryRiskQuantity -
        input.sellableStock -
        input.incomingStock
    )
  );
  const lineCostPHP = input.requestedQuantity * input.unitCost;
  if (
    !Number.isSafeInteger(maxAllowedQuantity) ||
    !Number.isFinite(lineCostPHP) ||
    lineCostPHP < 0
  ) {
    return reject("INVALID_QUANTITY");
  }
  if (input.requestedQuantity > maxAllowedQuantity) {
    return reject("COVERAGE_LIMIT_EXCEEDED", maxAllowedQuantity, lineCostPHP);
  }
  if (lineCostPHP > RESTOCK_SAFETY_MAX_LINE_COST_PHP) {
    return reject("LINE_BUDGET_EXCEEDED", maxAllowedQuantity, lineCostPHP);
  }
  return { safe: true, maxAllowedQuantity, lineCostPHP };
}

export function exceedsRestockOrderBudget(lineCostsPHP: readonly number[]) {
  if (lineCostsPHP.some((cost) => !Number.isFinite(cost) || cost < 0)) return true;
  return lineCostsPHP.reduce((total, cost) => total + cost, 0) >
    RESTOCK_SAFETY_MAX_ORDER_COST_PHP;
}
