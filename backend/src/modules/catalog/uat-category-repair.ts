/**
 * D01 UAT catalog corrections.
 *
 * These rules are intentionally narrow: they only move clearly misfiled grocery
 * products, and leave ambiguous names for human review. No database writes happen here.
 */

const REVIEWED_BAKING_SOURCE_SNACK_IDS = new Set([
  "P236", "P297", "P299", "P305", "P307", "P321", "P352", "P361",
  "P370", "P373", "P401", "P412", "P426", "P427", "P430", "P462", "P464"
]);
const REVIEWED_BAKING_SOURCE_PASTA_IDS = new Set(["P210", "P326"]);
const TISSUE_PRODUCT_NAME = /\b(?:tissues?|toilet paper|bathroom tissue|paper towels?|napkins?|cotton balls?)\b/i;
const OBVIOUS_SNACK_NAME = /\b(?:piattos|tortillos|potato chips|corn chips|potato rings)\b/i;
const DAIRY_PRODUCT_NAME = /\b(?:milk|yogurt|yoghurt|butter|cheese)\b/i;
const FROZEN_FOOD_NAME = /\b(?:ice cream|frozen|hotdog|sausage|tocino|longganisa|siomai|dumpling)\b/i;

export type UatCategoryRepairCandidate = {
  currentCategorySlug: string;
  productName: string;
  sourceProductId?: string | null;
};

/**
 * Return the correct canonical category slug only for clear D01 cases.
 * A null result means no automatic change is justified by this evidence.
 */
export function proposedUatCategoryCorrection({
  currentCategorySlug,
  productName,
  sourceProductId
}: UatCategoryRepairCandidate): string | null {
  const name = productName.trim();
  const sourceCode = sourceProductId?.trim().toUpperCase();

  if (currentCategorySlug === "baking-dessert") {
    if (TISSUE_PRODUCT_NAME.test(name)) return "tissue-cotton";
    if (sourceCode && REVIEWED_BAKING_SOURCE_PASTA_IDS.has(sourceCode)) {
      return "noodles-pasta";
    }
    if ((sourceCode && REVIEWED_BAKING_SOURCE_SNACK_IDS.has(sourceCode)) ||
        OBVIOUS_SNACK_NAME.test(name)) {
      return "snacks-confectionery";
    }
  }

  // Fresh dairy belongs in its own aisle; ice cream and frozen meat remain frozen.
  if (currentCategorySlug === "frozen-chilled" &&
      DAIRY_PRODUCT_NAME.test(name) &&
      !FROZEN_FOOD_NAME.test(name)) {
    return "dairy-products";
  }

  return null;
}
