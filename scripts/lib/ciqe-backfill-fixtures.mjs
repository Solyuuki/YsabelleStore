const CATEGORY_PATTERN = /^Backfill (Eligible|Existing|Dry Run|Apply) ([0-9a-f]{8})$/i;

const LABEL_TO_SLUG = Object.freeze({
  APPLY: "apply",
  "DRY RUN": "dry-run",
  ELIGIBLE: "eligible",
  EXISTING: "existing"
});

export function parseCiqeBackfillFixtureCategory(category) {
  const match = CATEGORY_PATTERN.exec(String(category?.name ?? ""));
  if (!match) return null;

  const label = match[1].toUpperCase();
  const suffix = match[2].toLowerCase();
  const slugLabel = LABEL_TO_SLUG[label];
  if (!slugLabel) return null;
  if (String(category?.slug ?? "").toLowerCase() !== `backfill-${slugLabel}-${suffix}`) return null;

  return { label, suffix };
}

export function isMatchingCiqeBackfillFixtureProduct(product, fixture) {
  if (!fixture) return false;

  const displayLabel = fixture.label
    .toLowerCase()
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  const skuLabel = fixture.label.replaceAll(" ", "-");

  return (
    String(product?.name ?? "") === `Backfill ${displayLabel} Product ${fixture.suffix}` &&
    String(product?.sku ?? "").toUpperCase() === `BACKFILL-${skuLabel}-${fixture.suffix}`.toUpperCase()
  );
}
