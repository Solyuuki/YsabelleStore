const FIXTURE_VARIANTS = Object.freeze([
  Object.freeze({ kind: "eligible", label: "Eligible", skuToken: "ELIGIBLE" }),
  Object.freeze({ kind: "existing", label: "Existing", skuToken: "EXISTING" }),
  Object.freeze({ kind: "dry-run", label: "Dry Run", skuToken: "DRY-RUN" }),
  Object.freeze({ kind: "apply", label: "Apply", skuToken: "APPLY" })
]);

const GENERATED_SUFFIX_PATTERN = /^[0-9a-f]{8}$/i;

export function identifySprint6BackfillFixture(product) {
  for (const variant of FIXTURE_VARIANTS) {
    const categoryPrefix = `Backfill ${variant.label} `;
    const productPrefix = `Backfill ${variant.label} Product `;
    const skuPrefix = `BACKFILL-${variant.skuToken}-`;

    if (
      !product.categoryName?.startsWith(categoryPrefix) ||
      !product.name?.startsWith(productPrefix) ||
      !product.sku?.startsWith(skuPrefix)
    ) {
      continue;
    }

    const categorySuffix = product.categoryName.slice(categoryPrefix.length);
    const productSuffix = product.name.slice(productPrefix.length);
    const skuSuffix = product.sku.slice(skuPrefix.length);

    if (
      GENERATED_SUFFIX_PATTERN.test(categorySuffix) &&
      categorySuffix.toLowerCase() === productSuffix.toLowerCase() &&
      categorySuffix.toLowerCase() === skuSuffix.toLowerCase()
    ) {
      return { kind: variant.kind, suffix: categorySuffix.toLowerCase() };
    }
  }

  return null;
}
