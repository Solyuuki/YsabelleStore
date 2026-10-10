/**
 * Read-only operational restock safety audit.
 *
 * Connects ONLY to the local development ysabellestore MySQL DB, using
 * SELECT-only Prisma queries. Does not call restock worker, generate forecasts,
 * approve, receive, cancel, create or modify any order or stock.
 * Never prints connection credentials.
 *
 * Usage:
 *   npx tsx backend/src/scripts/restockSafetyAudit.ts --order RO-OCT-2026
 */
import { prisma } from "../database/prismaClient.js";
import { env } from "../config/env.js";
import { requiresAutomatedQuantityReview } from "../services/restockDraftReconciliation.js";
import { assessProcurementSafety } from "../services/restockProcurementSafety.js";
import { listRestockPlanningCandidates } from "../services/restockPlanningService.js";

function assertSafeLocalDatabase() {
  if (!env.DATABASE_URL) {
    throw new Error("QA_READ_ONLY_BLOCKED: DATABASE_URL is missing.");
  }
  const url = new URL(env.DATABASE_URL);
  const dbName = decodeURIComponent(url.pathname.slice(1));
  if (
    url.protocol !== "mysql:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    dbName !== "ysabellestore" ||
    env.NODE_ENV === "production"
  ) {
    throw new Error(
      "QA_READ_ONLY_BLOCKED: requires local MySQL database ysabellestore and nonproduction NODE_ENV."
    );
  }
}

function requestedOrderNumber() {
  const args = process.argv.slice(2);
  if (args.length === 0) return "RO-OCT-2026";
  const value = args[1];
  if (args.length === 2 && args[0] === "--order" && value && /^RO-[A-Z0-9-]{3,35}$/.test(value)) {
    return value;
  }
  throw new Error("Usage: npx tsx backend/src/scripts/restockSafetyAudit.ts [--order RO-OCT-2026]");
}

function finiteUnits(value: number) {
  return Number.isFinite(value) && Number.isSafeInteger(value) && value >= 0;
}

async function main() {
  assertSafeLocalDatabase();
  const orderNumber = requestedOrderNumber();

  // All reads: no transaction writes, no schema migrations, no fixtures.
  const order = await prisma.restockOrder.findFirst({
    where: { orderNumber },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      version: true,
      notes: true,
      createdAt: true,
      approvedAt: true,
      lines: {
        select: {
          productId: true,
          isSelected: true,
          ownerOverrideReason: true,
          recommendationSource: true,
          recommendedQuantity: true,
          requestedQuantity: true,
          receivedQuantity: true,
          product: { select: { name: true, sku: true } }
        }
      }
    }
  });
  if (!order) {
    console.log(JSON.stringify({
      kind: "YSABELLE_QA_RESTOCK_READ_ONLY_AUDIT",
      database: "localhost/ysabellestore",
      orderNumber,
      status: "ORDER_NOT_FOUND",
      writes: 0,
      note: "No ticket was modified. Confirm the order number in Receiving."
    }, null, 2));
    return;
  }

  const automatedLines = order.lines.filter(
    (line) => line.isSelected && line.recommendationSource !== "MANUAL"
  );
  const productIds = [...new Set(automatedLines.map((line) => line.productId))];
  const fresh = productIds.length
    ? await listRestockPlanningCandidates(
        { page: 1, pageSize: productIds.length, includeZero: true },
        productIds,
        order.id
      )
    : { items: [] };
  const byId = new Map(fresh.items.map((c) => [c.product.id, c]));

  const lines = automatedLines.map((line) => {
    const current = byId.get(line.productId);
    const latest = current?.recommendedQuantity;
    const hasValidQuantity =
      finiteUnits(line.recommendedQuantity) &&
      finiteUnits(line.requestedQuantity) &&
      finiteUnits(line.receivedQuantity);
    const anomalousSaved =
      latest === undefined || !hasValidQuantity ||
      requiresAutomatedQuantityReview(line.recommendedQuantity, latest, null);
    const anomalousRequested =
      latest === undefined || !hasValidQuantity ||
      requiresAutomatedQuantityReview(
        line.requestedQuantity,
        latest,
        line.ownerOverrideReason
      );
    const remainingUnits = Math.max(0, line.requestedQuantity - line.receivedQuantity);
    const purchaseSafety = current
      ? assessProcurementSafety({
          requestedQuantity: remainingUnits > 0 ? remainingUnits : line.requestedQuantity,
          monthlyPosDemand: current.stockHealth.monthlyDemand,
          posConfidence: current.stockHealth.confidence,
          sellableStock: current.sellableStock,
          incomingStock: current.incomingStock,
          expiryRiskQuantity: current.expiryRiskQuantity,
          unitCost: current.product.unitCost,
          recommendationSource: line.recommendationSource,
          targetStockLevel: current.product.targetStockLevel,
          approvedTargetStockLevel: current.product.approvedTargetStockLevel,
          targetApprovalById: current.product.targetApprovalById,
          targetApprovedAt: current.product.targetApprovedAt
        })
      : null;
    return {
      sku: line.product.sku,
      name: line.product.name,
      recommendationSource: line.recommendationSource,
      savedRecommendedUnits: line.recommendedQuantity,
      requestedUnits: line.requestedQuantity,
      alreadyReceivedUnits: line.receivedQuantity,
      remainingUnits,
      freshRecommendedUnitsExcludingThisOrder: latest ?? null,
      sellableStock: current?.sellableStock ?? null,
      incomingFromOtherOrders: current?.incomingStock ?? null,
      expectedMonthlyDemand: current?.forecastDecision.currentMonthDemand ?? null,
      verifiedPosMonthlyDemand: current?.stockHealth.monthlyDemand ?? null,
      posHistoryConfidence: current?.stockHealth.confidence ?? null,
      knownUnitCostPHP: current?.product.unitCost ?? null,
      independentPurchaseSafety: purchaseSafety,
      targetStockLevel: current?.product.targetStockLevel ?? null,
      flaggedForReview: anomalousSaved || anomalousRequested || purchaseSafety?.safe !== true,
      reason:
        latest === undefined
          ? "NO_ELIGIBLE_CURRENT_FORECAST"
          : !hasValidQuantity
            ? "INVALID_SAVED_QUANTITY"
            : anomalousSaved
              ? "SAVED_AUTOMATED_QUANTITY_EXCEEDS_FRESH_BASELINE"
              : anomalousRequested
                ? "REQUESTED_QUANTITY_EXCEEDS_FRESH_BASELINE"
                : "WITHIN_CURRENT_ANOMALY_THRESHOLD"
    };
  });
  const flagged = lines.filter((line) => line.flaggedForReview).length;

  console.log(JSON.stringify({
    kind: "YSABELLE_QA_RESTOCK_READ_ONLY_AUDIT",
    database: "localhost/ysabellestore",
    orderNumber: order.orderNumber,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
    approvedAt: order.approvedAt?.toISOString() ?? null,
    automatedMonthlyTicket: Boolean(order.notes?.includes("[AutomatedRestockMonth:")),
    selectedAutomatedLineCount: lines.length,
    flaggedLineCount: flagged,
    lines,
    writes: 0,
    releaseStatus: "NOT_CERTIFIED",
    note: "Current-time read-only diagnostic only; no order is authorized by this report and no ticket/inventory was modified."
  }, null, 2));
}

void main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("QA_READ_ONLY_AUDIT_FAILED:", message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
