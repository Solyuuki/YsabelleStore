import { createHash } from "node:crypto";

export const YSABELLE_INTERNAL_BARCODE_PREFIX = "YSB-";
export const YSABELLE_INTERNAL_BARCODE_SCHEME = "CODE128";
const MAX_PRODUCT_BARCODE_LENGTH = 80;

export function buildYsabelleInternalBarcode(input: {
  id: string;
  sku: string;
  attempt?: number;
}): string {
  const attempt = Math.max(0, Math.trunc(input.attempt ?? 0));
  const normalizedSku = input.sku
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const collisionSuffix = attempt > 0 ? `-${attempt}` : "";
  const readableCandidate = `${YSABELLE_INTERNAL_BARCODE_PREFIX}${normalizedSku}${collisionSuffix}`;

  if (normalizedSku && readableCandidate.length <= MAX_PRODUCT_BARCODE_LENGTH) {
    return readableCandidate;
  }

  const stableDigest = createHash("sha256")
    .update(`${input.id}\u0000${input.sku}\u0000${attempt}`)
    .digest("hex")
    .slice(0, 24)
    .toUpperCase();

  return `${YSABELLE_INTERNAL_BARCODE_PREFIX}${stableDigest}`;
}

export function isYsabelleInternalBarcode(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith(YSABELLE_INTERNAL_BARCODE_PREFIX));
}
