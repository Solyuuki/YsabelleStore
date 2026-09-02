import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { OperationalCatalogCandidateRow } from "../modules/catalog/catalog-operational-audit.js";
import {
  buildCatalogPromotionCategoryMutationPlan,
  type CatalogPromotionCategoryMutationPlan
} from "../modules/catalog/catalog-promotion-category-mutation-plan.js";
import type { CatalogPromotionCategoryOperationalizationPreview } from "../modules/catalog/catalog-promotion-category-operationalization-preview.js";
import type { SarimaSourceIdentity } from "../modules/catalog/sarima-source-manifest.js";
import { resolveRepositoryPath } from "../modules/forecasting/repository-paths.js";

const DEFAULT_OPERATIONALIZATION_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-catalog-promotion-category-operationalization-preview.json"
);
const DEFAULT_AUDIT_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-operational-catalog-audit.json"
);
const DEFAULT_SOURCES_PATH = resolveRepositoryPath(
  "artifacts/catalog/phase9/sarima-source-manifest.json"
);
const DEFAULT_JSON_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-catalog-promotion-category-mutation-plan.json"
);
const DEFAULT_REPORT_PATH = resolveRepositoryPath(
  "docs/catalog/phase9-catalog-promotion-category-mutation-plan.md"
);

type OperationalAuditArtifact = {
  candidateRows: OperationalCatalogCandidateRow[];
};

export type GenerateCatalogPromotionCategoryMutationPlanOptions = {
  operationalizationPath?: string;
  auditPath?: string;
  sourcesPath?: string;
  jsonPath?: string;
  reportPath?: string;
};

async function readJson<T>(filePath: string, label: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    throw new Error(`Invalid JSON in ${label}: ${filePath}.`, { cause: error });
  }
}

async function writeText(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

function markdownCell(value: string) {
  return value.replace(/\|/g, "\\|");
}

function toMarkdown(plan: CatalogPromotionCategoryMutationPlan) {
  const { summary } = plan;
  return [
    "# Phase 9 Catalog Promotion Category Mutation Plan",
    "",
    "**READ-ONLY FINAL CATEGORY PLAN.** This generator performs zero database mutations. It does not create, update, rename, merge, delete, or reassign Category or Product records.",
    "",
    "## Summary",
    "",
    `- ${summary.sourceCategories} source categories`,
    `- ${summary.proposedCategoryCreates} proposed Category creates`,
    `- ${summary.proposedCategoryReuses} proposed existing Category reuses`,
    `- ${summary.blockedCategories} blocked categories`,
    `- ${summary.seedAdoptionsCleared} seed-origin category adoptions cleared by source/audit evidence`,
    `- ${summary.actualMutationsPerformed} actual mutations performed`,
    "",
    "## Safety Boundary",
    "",
    "CREATE_CATEGORY entries are proposed payloads only. REUSE_EXISTING entries are evidence-backed taxonomy decisions only. Product identity blockers remain independent and are not changed by category reuse.",
    "",
    "## Decisions",
    "",
    "| Source category | Candidates | Decision | Reuse basis | Existing category | Proposed slug | Blockers |",
    "| --- | ---: | --- | --- | --- | --- | --- |",
    ...plan.rows.map((row) =>
      `| ${markdownCell(row.sourceCategory)} | ${row.candidateCount} | ${row.decision} | ${row.reuseBasis ?? "—"} | ${row.existingCategoryId ?? "—"} | ${row.proposedCategoryCreate?.slug ?? "—"} | ${row.blockers.length > 0 ? markdownCell(row.blockers.join(", ")) : "—"} |`
    ),
    "",
    "## Seed Adoption Evidence",
    "",
    ...plan.rows.flatMap((row) =>
      row.seedAdoptionEvidence.length === 0
        ? []
        : [
            `### ${row.sourceCategory}`,
            "",
            ...row.seedAdoptionEvidence.map(
              (evidence) =>
                `- ${evidence.sku} (${evidence.productId}) — audit ${evidence.auditStatus}; source ${evidence.productCode ?? "—"} → canonical ${evidence.canonicalProductCode ?? "—"}; source category ${evidence.sourceCategory ?? "—"}; canonical category ${evidence.canonicalCategory ?? "—"}; aligned: ${evidence.categoryAligned ? "yes" : "no"}`
            ),
            ""
          ]
    ),
    "No database write is executed by this artifact generator.",
    ""
  ].join("\n");
}

export async function generateCatalogPromotionCategoryMutationPlan(
  options: GenerateCatalogPromotionCategoryMutationPlanOptions = {}
): Promise<CatalogPromotionCategoryMutationPlan> {
  const operationalizationPath = options.operationalizationPath ?? DEFAULT_OPERATIONALIZATION_PATH;
  const auditPath = options.auditPath ?? DEFAULT_AUDIT_PATH;
  const sourcesPath = options.sourcesPath ?? DEFAULT_SOURCES_PATH;
  const jsonPath = options.jsonPath ?? DEFAULT_JSON_PATH;
  const reportPath = options.reportPath ?? DEFAULT_REPORT_PATH;

  const [operationalization, audit, sources] = await Promise.all([
    readJson<CatalogPromotionCategoryOperationalizationPreview>(
      operationalizationPath,
      "category operationalization preview"
    ),
    readJson<OperationalAuditArtifact>(auditPath, "operational catalog audit"),
    readJson<SarimaSourceIdentity[]>(sourcesPath, "SARIMA source manifest")
  ]);

  if (!Array.isArray(operationalization.rows)) {
    throw new Error(`Category operationalization preview is malformed: ${operationalizationPath}.`);
  }
  if (!Array.isArray(audit.candidateRows)) {
    throw new Error(`Operational catalog audit is malformed: ${auditPath}.`);
  }
  if (!Array.isArray(sources)) {
    throw new Error(`SARIMA source manifest must contain an array: ${sourcesPath}.`);
  }

  const plan = buildCatalogPromotionCategoryMutationPlan({
    operationalization,
    audit,
    sources
  });

  await Promise.all([
    writeText(jsonPath, `${JSON.stringify(plan, null, 2)}\n`),
    writeText(reportPath, toMarkdown(plan))
  ]);

  return plan;
}

function isDirectExecution() {
  const entryPoint = process.argv[1];
  return Boolean(entryPoint) && path.resolve(entryPoint!) === path.resolve(fileURLToPath(import.meta.url));
}

if (isDirectExecution()) {
  const plan = await generateCatalogPromotionCategoryMutationPlan();
  console.log(JSON.stringify(plan.summary, null, 2));
}
