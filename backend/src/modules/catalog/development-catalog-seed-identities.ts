export type DevelopmentCatalogSeedIdentity = {
  id: string;
  sku: string;
};

export const DEVELOPMENT_CATALOG_SEED_IDENTITIES = [
  { id: "prd_cola_15l", sku: "BEV-COLA-001" },
  { id: "prd_mineral_water_500ml", sku: "BEV-WATER-001" },
  { id: "prd_sardines_155g", sku: "CAN-SARD-001" },
  { id: "prd_cheese_crackers", sku: "SNK-CRACK-001" },
  { id: "prd_beef_noodles", sku: "NDL-BEEF-001" },
  { id: "prd_shampoo_180ml", sku: "TOI-SHAMP-001" },
  { id: "prd_dishwashing_liquid", sku: "HSE-DISH-001" },
  { id: "prd_hand_sanitizer", sku: "TOI-SANI-001" }
] as const satisfies readonly DevelopmentCatalogSeedIdentity[];

const developmentSeedKeys = new Set(
  DEVELOPMENT_CATALOG_SEED_IDENTITIES.map(({ id, sku }) => `${id}\u0000${sku}`)
);

export function isDevelopmentCatalogSeedProduct(product: { id: string; sku: string }) {
  return developmentSeedKeys.has(`${product.id}\u0000${product.sku}`);
}
