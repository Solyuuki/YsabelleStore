import { spawnSync } from "node:child_process";

import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV === "production") {
  throw new Error("Development fixtures cannot be seeded when NODE_ENV=production.");
}

const prisma = new PrismaClient();

const CATEGORY_IDENTITIES = [
  ["cat_beverages", "beverages"],
  ["cat_canned_goods", "canned-goods"],
  ["cat_snacks", "snacks"],
  ["cat_instant_noodles", "instant-noodles"],
  ["cat_toiletries", "toiletries"],
  ["cat_household_products", "household-products"]
];

const PRODUCT_IDENTITIES = [
  ["prd_cola_15l", "BEV-COLA-001"],
  ["prd_mineral_water_500ml", "BEV-WATER-001"],
  ["prd_sardines_155g", "CAN-SARD-001"],
  ["prd_cheese_crackers", "SNK-CRACK-001"],
  ["prd_beef_noodles", "NDL-BEEF-001"],
  ["prd_shampoo_180ml", "TOI-SHAMP-001"],
  ["prd_dishwashing_liquid", "HSE-DISH-001"],
  ["prd_hand_sanitizer", "TOI-SANI-001"]
];

const INVENTORY_IDENTITIES = [
  ["inv_cola_15l", "prd_cola_15l"],
  ["inv_water_500ml", "prd_mineral_water_500ml"],
  ["inv_sardines_155g", "prd_sardines_155g"],
  ["inv_cheese_crackers", "prd_cheese_crackers"],
  ["inv_beef_noodles", "prd_beef_noodles"],
  ["inv_shampoo_180ml", "prd_shampoo_180ml"],
  ["inv_dishwashing_liquid", "prd_dishwashing_liquid"],
  ["inv_hand_sanitizer", "prd_hand_sanitizer"]
];

async function reconcileCategoryIds() {
  for (const [id, slug] of CATEGORY_IDENTITIES) {
    const [byId, bySlug] = await Promise.all([
      prisma.category.findUnique({ where: { id } }),
      prisma.category.findUnique({ where: { slug } })
    ]);

    if (byId && !bySlug && byId.slug !== slug) {
      await prisma.category.update({
        where: { id },
        data: { slug }
      });
      console.info(`Reconciled category identity ${id} -> ${slug}.`);
    }
  }
}

async function reconcileProductIds() {
  for (const [id, sku] of PRODUCT_IDENTITIES) {
    const [byId, bySku] = await Promise.all([
      prisma.product.findUnique({ where: { id } }),
      prisma.product.findUnique({ where: { sku } })
    ]);

    if (byId && !bySku && byId.sku !== sku) {
      await prisma.product.update({
        where: { id },
        data: { sku }
      });
      console.info(`Reconciled product identity ${id} -> ${sku}.`);
    }
  }
}

async function reconcileInventoryIds() {
  for (const [id, canonicalProductId] of INVENTORY_IDENTITIES) {
    const product = await prisma.product.findUnique({ where: { id: canonicalProductId } });
    if (!product) {
      continue;
    }

    const [byId, byProduct] = await Promise.all([
      prisma.inventory.findUnique({ where: { id } }),
      prisma.inventory.findUnique({ where: { productId: product.id } })
    ]);

    if (byId && !byProduct && byId.productId !== product.id) {
      await prisma.inventory.update({
        where: { id },
        data: { productId: product.id }
      });
      console.info(`Reconciled inventory identity ${id} -> ${product.id}.`);
    }
  }
}

try {
  await reconcileCategoryIds();
  await reconcileProductIds();
  await reconcileInventoryIds();
} finally {
  await prisma.$disconnect();
}

const child = spawnSync(process.execPath, ["database/seed/development.mjs"], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit"
});

if (child.error) {
  throw child.error;
}

process.exitCode = child.status ?? 1;
