import type { ProductSizeUnit } from "@prisma/client";

const SIZE_PATTERN = /(?:^|\s)(\d+(?:\.\d+)?)\s*(ml|l|g|kg|pcs?)(?=$|\s|[),])/i;

export function normalizeCanonicalProductName(value: string) {
  return value
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

export function extractCanonicalProductSize(value: string) {
  const match = normalizeCanonicalProductName(value).match(SIZE_PATTERN);
  if (!match) return { sizeUnit: null, sizeValue: null };

  return {
    sizeUnit: sizeUnit(match[2] ?? ""),
    sizeValue: match[1] ?? null
  };
}

export function normalizeProductIdentity(value: string) {
  return normalizeCanonicalProductName(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type CatalogIdentityProduct = {
  brand?: string | null;
  name: string;
  sizeUnit?: ProductSizeUnit | null;
  sizeValue?: { toString(): string } | number | string | null;
  variant?: string | null;
};

export function isLikelySameCatalogIdentity(
  left: CatalogIdentityProduct,
  right: CatalogIdentityProduct
) {
  if (normalizeProductIdentity(left.name) !== normalizeProductIdentity(right.name)) return false;
  if (knownAttributeDiffers(left.brand, right.brand)) return false;
  if (knownAttributeDiffers(left.variant, right.variant)) return false;

  const leftSize = catalogSizeKey(left);
  const rightSize = catalogSizeKey(right);
  return !leftSize || !rightSize || leftSize === rightSize;
}

function canonicalVolume(amount: number, sourceUnit: "ml" | "L") {
  if (sourceUnit === "ml" && amount >= 1000 && amount % 100 === 0) {
    return `${formatNumber(amount / 1000)}L`;
  }

  return `${formatNumber(amount)}${sourceUnit}`;
}

function sizeUnit(unit: string): ProductSizeUnit {
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

function knownAttributeDiffers(left: string | null | undefined, right: string | null | undefined) {
  if (!left || !right) return false;
  return normalizeProductIdentity(left) !== normalizeProductIdentity(right);
}

function catalogSizeKey(product: CatalogIdentityProduct) {
  const extracted = extractCanonicalProductSize(product.name);
  const unit = product.sizeUnit ?? extracted.sizeUnit;
  const rawValue = product.sizeValue?.toString() ?? extracted.sizeValue;
  if (!unit || !rawValue) return null;

  const value = Number(rawValue);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (unit === "LITER") return `VOLUME:${formatNumber(value * 1000)}`;
  if (unit === "MILLILITER") return `VOLUME:${formatNumber(value)}`;
  if (unit === "KILOGRAM") return `WEIGHT:${formatNumber(value * 1000)}`;
  if (unit === "GRAM") return `WEIGHT:${formatNumber(value)}`;
  return `PIECE:${formatNumber(value)}`;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace(/0+$/, "");
}
