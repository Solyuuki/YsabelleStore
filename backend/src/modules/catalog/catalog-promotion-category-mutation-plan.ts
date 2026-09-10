import type { OperationalCatalogCandidateRow } from "./catalog-operational-audit.js";
import type {
  CatalogPromotionCategoryOperationalizationPreview,
  ProposedOperationalCategory
} from "./catalog-promotion-category-operationalization-preview.js";
import type { SarimaSourceIdentity } from "./sarima-source-manifest.js";

export type CategoryMutationPlanDecision = "CREATE_CATEGORY" | "REUSE_EXISTING" | "BLOCKED_REVIEW";

export type CategoryMutationPlanReuseBasis =
  | "EXACT_NAME"
  | "SLUG_EQUIVALENCE"
  | "SEED_CATEGORY_EVIDENCE";

export type SeedAdoptionEvidence = {
  productId: string;
  sku: string;
  productCode: string | null;
  canonicalProductCode: string | null;
  auditStatus: OperationalCatalogCandidateRow["status"] | "NOT_FOUND";
  sourceCategory: string | null;
  canonicalCategory: string | null;
  categoryAligned: boolean;
};

export type CatalogPromotionCategoryMutationPlanRow = {
  sourceCategory: string;
  candidateCount: number;
  decision: CategoryMutationPlanDecision;
  proposedCategoryCreate: ProposedOperationalCategory | null;
  existingCategoryId: string | null;
  reuseBasis: CategoryMutationPlanReuseBasis | null;
  blockers: string[];
  seedAdoptionEvidence: SeedAdoptionEvidence[];
};

export type CatalogPromotionCategoryMutationPlan = {
  summary: {
    sourceCategories: number;
    proposedCategoryCreates: number;
    proposedCategoryReuses: number;
    blockedCategories: number;
    seedAdoptionsCleared: number;
    actualMutationsPerformed: 0;
  };
  rows: CatalogPromotionCategoryMutationPlanRow[];
};

type OperationalAuditInput = {
  candidateRows: OperationalCatalogCandidateRow[];
};

function findAuditRow(productId: string, rows: OperationalCatalogCandidateRow[]) {
  return rows.find(
    (row) =>
      row.operationalProductId === productId ||
      row.candidateOperationalProductIds.includes(productId)
  );
}

function buildSourceIndex(sources: SarimaSourceIdentity[]) {
  return new Map(sources.map((source) => [source.productCode, source]));
}

export function buildCatalogPromotionCategoryMutationPlan(input: {
  operationalization: CatalogPromotionCategoryOperationalizationPreview;
  audit: OperationalAuditInput;
  sources: SarimaSourceIdentity[];
}): CatalogPromotionCategoryMutationPlan {
  const sourceByCode = buildSourceIndex(input.sources);
  let seedAdoptionsCleared = 0;

  const rows = input.operationalization.rows.map((row): CatalogPromotionCategoryMutationPlanRow => {
    if (row.decision === "PROPOSE_CREATE" && row.proposedCategory) {
      return {
        sourceCategory: row.sourceCategory,
        candidateCount: row.candidateCount,
        decision: "CREATE_CATEGORY",
        proposedCategoryCreate: row.proposedCategory,
        existingCategoryId: null,
        reuseBasis: null,
        blockers: [],
        seedAdoptionEvidence: []
      };
    }

    if (row.decision === "REUSE_EXISTING" && row.existingCategoryId) {
      return {
        sourceCategory: row.sourceCategory,
        candidateCount: row.candidateCount,
        decision: "REUSE_EXISTING",
        proposedCategoryCreate: null,
        existingCategoryId: row.existingCategoryId,
        reuseBasis: row.reuseBasis,
        blockers: [],
        seedAdoptionEvidence: []
      };
    }

    if (row.decision === "REVIEW_ADOPT_SEED" && row.existingCategoryId) {
      const nonSeedReferences = row.seedCategoryProducts.filter(
        (product) => !product.isDevelopmentSeed
      );
      const evidence = nonSeedReferences.map((product): SeedAdoptionEvidence => {
        const auditRow = findAuditRow(product.id, input.audit.candidateRows);
        if (!auditRow) {
          return {
            productId: product.id,
            sku: product.sku,
            productCode: null,
            canonicalProductCode: null,
            auditStatus: "NOT_FOUND",
            sourceCategory: null,
            canonicalCategory: null,
            categoryAligned: false
          };
        }

        const source = sourceByCode.get(auditRow.productCode) ?? null;
        const canonical = sourceByCode.get(auditRow.canonicalProductCode) ?? null;
        const sourceAligned = source?.category === row.sourceCategory;
        const canonicalAligned = canonical?.category === row.sourceCategory;
        const auditableStatus = auditRow.status === "EXISTING" || auditRow.status === "BLOCKED";

        return {
          productId: product.id,
          sku: product.sku,
          productCode: auditRow.productCode,
          canonicalProductCode: auditRow.canonicalProductCode,
          auditStatus: auditRow.status,
          sourceCategory: source?.category ?? null,
          canonicalCategory: canonical?.category ?? null,
          categoryAligned: Boolean(auditableStatus && sourceAligned && canonicalAligned)
        };
      });

      const blockers: string[] = [];
      if (evidence.some((item) => item.auditStatus === "NOT_FOUND")) {
        blockers.push("SEED_CATEGORY_REFERENCE_AUDIT_NOT_FOUND");
      }
      if (evidence.some((item) => item.auditStatus !== "NOT_FOUND" && !item.categoryAligned)) {
        blockers.push("SEED_CATEGORY_REFERENCE_CATEGORY_MISMATCH");
      }

      if (blockers.length === 0) {
        seedAdoptionsCleared += 1;
        return {
          sourceCategory: row.sourceCategory,
          candidateCount: row.candidateCount,
          decision: "REUSE_EXISTING",
          proposedCategoryCreate: null,
          existingCategoryId: row.existingCategoryId,
          reuseBasis: "SEED_CATEGORY_EVIDENCE",
          blockers: [],
          seedAdoptionEvidence: evidence
        };
      }

      return {
        sourceCategory: row.sourceCategory,
        candidateCount: row.candidateCount,
        decision: "BLOCKED_REVIEW",
        proposedCategoryCreate: null,
        existingCategoryId: row.existingCategoryId,
        reuseBasis: null,
        blockers,
        seedAdoptionEvidence: evidence
      };
    }

    return {
      sourceCategory: row.sourceCategory,
      candidateCount: row.candidateCount,
      decision: "BLOCKED_REVIEW",
      proposedCategoryCreate: null,
      existingCategoryId: row.existingCategoryId,
      reuseBasis: null,
      blockers: [`OPERATIONALIZATION_${row.decision}`],
      seedAdoptionEvidence: []
    };
  });

  return {
    summary: {
      sourceCategories: rows.length,
      proposedCategoryCreates: rows.filter((row) => row.decision === "CREATE_CATEGORY").length,
      proposedCategoryReuses: rows.filter((row) => row.decision === "REUSE_EXISTING").length,
      blockedCategories: rows.filter((row) => row.decision === "BLOCKED_REVIEW").length,
      seedAdoptionsCleared,
      actualMutationsPerformed: 0
    },
    rows
  };
}
