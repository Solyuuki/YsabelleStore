import { createHash } from "node:crypto";

export const YSABELLE_INTERNAL_BARCODE_PREFIX = "YSB-";
export const YSABELLE_INTERNAL_BARCODE_SCHEME = "CODE128";
const MAX_PRODUCT_BARCODE_LENGTH = 80;

export function buildYsabelleInternalBarcode(input: { id: string; sku: string }): string {
  const normalizedSku = input.sku
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const readableCandidate = `${YSABELLE_INTERNAL_BARCODE_PREFIX}${normalizedSku}`;

  if (normalizedSku && readableCandidate.length <= MAX_PRODUCT_BARCODE_LENGTH) {
    return readableCandidate;
  }

  const stableDigest = createHash("sha256")
    .update(`${input.id}\u0000${input.sku}`)
    .digest("hex")
    .slice(0, 24)
    .toUpperCase();

  return `${YSABELLE_INTERNAL_BARCODE_PREFIX}${stableDigest}`;
}

export function isYsabelleInternalBarcode(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith(YSABELLE_INTERNAL_BARCODE_PREFIX));
}
