const GENERATED_BARCODE = /^99[0-9a-f]{13}$/i;
const GENERATED_SUFFIX = "[0-9a-f]{8}";

const FIXTURE_CATEGORY_PATTERNS = [
  ["DATA_FLOW_DEBUG_CATEGORY", new RegExp(`^Dbg ${GENERATED_SUFFIX}$`, "i")],
  ["DUPLICATE_CATEGORY_TEST", new RegExp(`^Duplicate Category ${GENERATED_SUFFIX}$`, "i")],
  [
    "CIQE_BACKFILL_TEST",
    new RegExp(`^Backfill (?:Eligible|Existing|Dry Run|Apply) ${GENERATED_SUFFIX}$`, "i")
  ],
  ["CUSTOMER_ORDER_TEST", new RegExp(`^Customer Order Test ${GENERATED_SUFFIX}$`, "i")],
  ["INVENTORY_IMPORT_TEST", new RegExp(`^Inventory Import ${GENERATED_SUFFIX}$`, "i")],
  ["MANUAL_CATEGORY_TEST", new RegExp(`^Manual Category ${GENERATED_SUFFIX}$`, "i")],
  ["SLUG_CATEGORY_TEST", new RegExp(`^Slug Category ${GENERATED_SUFFIX}$`, "i")],
  ["STOREFRONT_TEST", new RegExp(`^Storefront Test ${GENERATED_SUFFIX}$`, "i")],
  ["TEST_CATEGORY", /^Test Category [0-9a-f]{6}$/i]
];

const SIZE_PATTERN = /(?:^|\s)(\d+(?:\.\d+)?)\s*(ml|l|g|kg|pcs?)(?=$|\s|[),])/i;

export const CANONICAL_CATEGORY_UPDATES = Object.freeze({
  "Canned goods": Object.freeze({ name: "Canned Goods", slug: "canned-goods" }),
  "Household products": Object.freeze({ name: "Household", slug: "household" }),
  "Instant noodles": Object.freeze({ name: "Instant Food", slug: "instant-food" }),
  Pantry: Object.freeze({ name: "Staples", slug: "staples" }),
  Toiletries: Object.freeze({ name: "Personal Care", slug: "personal-care" })
});

export function fixtureCategoryEvidence(category) {
  const matches = FIXTURE_CATEGORY_PATTERNS.filter(([, pattern]) => pattern.test(category.name));
  return matches.map(([reason]) => reason);
}

export function fixtureProductEvidence(product) {
  const evidence = [];
  const categoryEvidence = fixtureCategoryEvidence(product.category);
  const generatedBarcode = GENERATED_BARCODE.test(product.barcode ?? "");

  if (categoryEvidence.length > 0) {
    evidence.push(...categoryEvidence.map((reason) => `FIXTURE_CATEGORY:${reason}`));
  }

  if (
    /^DATA FLOW TEST PRODUCT [0-9a-f]{8}$/i.test(product.name) &&
    /^(?:TEST|ROLLBACK)-[A-F0-9]{8,12}(?:-[A-F0-9]{3})?$/i.test(product.sku) &&
    generatedBarcode
  ) {
    evidence.push("DATA_FLOW_GENERATOR_SIGNATURE");
  }

  if (
    /^POSPAG-Q-[0-9a-f]{8}-\d+$/i.test(product.name) &&
    /^POS\d+-[A-F0-9]{8,12}(?:-[A-F0-9]{3})?$/i.test(product.sku) &&
    generatedBarcode
  ) {
    evidence.push("POS_PAGINATION_GENERATOR_SIGNATURE");
  }

  if (
    /^Imported Product-[0-9a-f]{8}$/i.test(product.name) &&
    /^IMP-[A-F0-9]{8,12}(?:-[A-F0-9]{3})?$/i.test(product.sku) &&
    generatedBarcode
  ) {
    evidence.push("PRODUCT_IMPORT_GENERATOR_SIGNATURE");
  }

  if (
    /^Inventory Import Product [A-F0-9]{8}$/i.test(product.name) &&
    /^IMP-[A-F0-9]{8}$/i.test(product.sku) &&
    generatedBarcode
  ) {
    evidence.push("INVENTORY_IMPORT_GENERATOR_SIGNATURE");
  }

  if (
    /^DbgProd [0-9a-f]{8}$/i.test(product.name) &&
    /^DBG-[A-F0-9]{8}$/i.test(product.sku) &&
    generatedBarcode
  ) {
    evidence.push("DEBUG_PRODUCT_GENERATOR_SIGNATURE");
  }

  return [...new Set(evidence)];
}

export function normalizeCatalogIdentity(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/(\d+(?:\.\d+)?)\s*(?:millilit(?:er|re)s?|ml)\b/g, "$1ml")
    .replace(/(\d+(?:\.\d+)?)\s*(?:lit(?:er|re)s?|l)\b/g, "$1l")
    .replace(/(\d+(?:\.\d+)?)\s*(?:grams?|g)\b/g, "$1g")
    .replace(/(\d+(?:\.\d+)?)\s*(?:kilograms?|kilos?|kg)\b/g, "$1kg")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeCategoryIdentity(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function normalizeCanonicalProductName(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/(\d+(?:\.\d+)?)\s*(?:millilit(?:er|re)s?|ml)\b/gi, (_, amount) =>
      canonicalVolume(Number(amount), "ml")
    )
    .replace(/(\d+(?:\.\d+)?)\s*(?:lit(?:er|re)s?|l)\b/gi, (_, amount) =>
      canonicalVolume(Number(amount), "L")
    )
    .replace(/(\d+(?:\.\d+)?)\s*(?:grams?|g)\b/gi, "$1g")
    .replace(/(\d+(?:\.\d+)?)\s*(?:kilograms?|kilos?|kg)\b/gi, "$1kg")
    .replace(/(\d+(?:\.\d+)?)\s*(?:pieces?|pcs?)\b/gi, "$1pcs");
}

export function extractCanonicalSize(value) {
  const normalized = normalizeCanonicalProductName(value);
  const match = normalized.match(SIZE_PATTERN);
  if (!match) return null;

  return Object.freeze({
    value: match[1],
    unit: canonicalSizeUnit(match[2])
  });
}

export function hasLifecycleDescriptionConflict(product) {
  return /\b(?:test(?:ing)?|fixture|smoke|debug|kept inactive|discontinued .* kept)\b/i.test(
    product.description ?? ""
  );
}

export function isValidCustomerName(value) {
  const normalized = String(value ?? "").trim();
  return (
    normalized.length >= 3 &&
    !/^(?:unknown|unnamed|n\/?a|null|test|sample|product)(?:\s|$)/i.test(normalized) &&
    !/[\u0000-\u001f]/.test(normalized)
  );
}

export function qualityIssuesForProduct(product, duplicateProductIds = new Set()) {
  const issues = [];

  if (fixtureProductEvidence(product).length > 0) issues.push("TEST_FIXTURE");
  if (!isValidCustomerName(product.name)) issues.push("INVALID_CUSTOMER_NAME");
  if (!product.category || !product.category.isActive) issues.push("INVALID_CATEGORY");
  if (Number(product.sellingPrice) <= 0) issues.push("INVALID_SELLING_PRICE");
  if (duplicateProductIds.has(product.id)) issues.push("UNRESOLVED_DUPLICATE");
  if (hasLifecycleDescriptionConflict(product)) issues.push("INTERNAL_DESCRIPTION");
  if (!product.brand) issues.push("MISSING_BRAND");
  if (!extractCanonicalSize(product.name)) issues.push("MISSING_SIZE");
  if (!product.barcode) issues.push("MISSING_BARCODE");
  if (!product.imageUrl) issues.push("MISSING_IMAGE");

  return issues;
}

function canonicalVolume(amount, sourceUnit) {
  if (sourceUnit === "ml" && amount >= 1000 && amount % 100 === 0) {
    return `${formatNumber(amount / 1000)}L`;
  }

  return `${formatNumber(amount)}${sourceUnit}`;
}

function canonicalSizeUnit(unit) {
  switch (unit.toLowerCase()) {
    case "ml":
      return "MILLILITER";
    case "l":
      return "LITER";
    case "g":
      return "GRAM";
    case "kg":
      return "KILOGRAM";
    default:
      return "PIECE";
  }
}

function formatNumber(value) {
  return Number.isInteger(value) ? String(value) : String(value).replace(/0+$/, "");
}
