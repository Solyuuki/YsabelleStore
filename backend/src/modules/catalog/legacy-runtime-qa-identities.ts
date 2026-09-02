export type LegacyRuntimeQaIdentity = {
  id: string;
  sku: string;
  barcode: string;
};

export const LEGACY_RUNTIME_QA_IDENTITIES: readonly LegacyRuntimeQaIdentity[] = [
  {
    id: "cmrdl144d0005ibqc05dq8jhv",
    sku: "PAN-UBE-001",
    barcode: "4800041123456"
  },
  {
    id: "cmrdl14710009ibqcwfyqtuiv",
    sku: "BEV-WAT-500",
    barcode: "4800041123463"
  },
  {
    id: "cmrdl1482000dibqcle38ptpp",
    sku: "PAN-BRD-001",
    barcode: "4800041123470"
  }
] as const;

const legacyRuntimeQaIdentityKeys = new Set(
  LEGACY_RUNTIME_QA_IDENTITIES.map(
    ({ id, sku, barcode }) => `${id}\u0000${sku}\u0000${barcode}`
  )
);

export function isLegacyRuntimeQaProduct(product: {
  id: string;
  sku: string;
  barcode: string | null;
}) {
  if (!product.barcode) return false;
  return legacyRuntimeQaIdentityKeys.has(
    `${product.id}\u0000${product.sku}\u0000${product.barcode}`
  );
}
