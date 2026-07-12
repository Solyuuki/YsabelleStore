import { createHash, scryptSync } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { PrismaClient } from "@prisma/client";

function loadRootEnv() {
  if (!existsSync(".env")) {
    return;
  }

  const lines = readFileSync(".env", "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");

    if (key && !process.env[key]) {
      process.env[key] = valueParts.join("=");
    }
  }
}

loadRootEnv();

const prisma = new PrismaClient();

const KEY_LENGTH = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;

function hashPassword(password, seed) {
  const salt = createHash("sha256").update(seed).digest("hex").slice(0, 32);
  const derivedKey = scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAX_MEMORY
  });

  return ["scrypt", SCRYPT_N, SCRYPT_R, SCRYPT_P, salt, derivedKey.toString("base64")].join("$");
}

function isoDate(value) {
  return new Date(value);
}

const categories = [
  {
    id: "cat_beverages",
    name: "Beverages",
    slug: "beverages",
    description: "Drinks and refreshment items",
    isActive: true
  },
  {
    id: "cat_canned_goods",
    name: "Canned goods",
    slug: "canned-goods",
    description: "Shelf-stable canned food items",
    isActive: true
  },
  {
    id: "cat_snacks",
    name: "Snacks",
    slug: "snacks",
    description: "Ready-to-eat snack items",
    isActive: true
  },
  {
    id: "cat_instant_noodles",
    name: "Instant noodles",
    slug: "instant-noodles",
    description: "Quick meal and noodle products",
    isActive: true
  },
  {
    id: "cat_toiletries",
    name: "Toiletries",
    slug: "toiletries",
    description: "Personal care and hygiene essentials",
    isActive: true
  },
  {
    id: "cat_household_products",
    name: "Household products",
    slug: "household-products",
    description: "Cleaning and home maintenance supplies",
    isActive: true
  }
];

const products = [
  {
    id: "prd_cola_15l",
    categoryId: "cat_beverages",
    sku: "BEV-COLA-001",
    barcode: "4800012345678",
    name: "Classic Cola 1.5L",
    description: "Large bottle cola for chilled display.",
    unit: "BOTTLE",
    costPrice: "22.00",
    sellingPrice: "28.00",
    reorderLevel: 12,
    targetStockLevel: 36,
    status: "ACTIVE"
  },
  {
    id: "prd_mineral_water_500ml",
    categoryId: "cat_beverages",
    sku: "BEV-WATER-001",
    barcode: "4800012345679",
    name: "Mineral Water 500ml",
    description: "Purified drinking water bottle.",
    unit: "BOTTLE",
    costPrice: "4.00",
    sellingPrice: "7.00",
    reorderLevel: 5,
    targetStockLevel: 24,
    status: "ACTIVE"
  },
  {
    id: "prd_sardines_155g",
    categoryId: "cat_canned_goods",
    sku: "CAN-SARD-001",
    barcode: "4800012345680",
    name: "Tomato Sardines 155g",
    description: "Classic sardines in tomato sauce.",
    unit: "PIECE",
    costPrice: "16.00",
    sellingPrice: "21.00",
    reorderLevel: 6,
    targetStockLevel: 18,
    status: "ACTIVE"
  },
  {
    id: "prd_cheese_crackers",
    categoryId: "cat_snacks",
    sku: "SNK-CRACK-001",
    barcode: "4800012345681",
    name: "Cheese Crackers",
    description: null,
    unit: "PACK",
    costPrice: "11.00",
    sellingPrice: "15.00",
    reorderLevel: 8,
    targetStockLevel: 24,
    status: "ACTIVE"
  },
  {
    id: "prd_beef_noodles",
    categoryId: "cat_instant_noodles",
    sku: "NDL-BEEF-001",
    barcode: "4800012345682",
    name: "Beef Instant Noodles",
    description: "Popular beef-flavored noodle pack.",
    unit: "PACK",
    costPrice: "6.50",
    sellingPrice: "8.00",
    reorderLevel: 6,
    targetStockLevel: 30,
    status: "ACTIVE"
  },
  {
    id: "prd_shampoo_180ml",
    categoryId: "cat_toiletries",
    sku: "TOI-SHAMP-001",
    barcode: "4800012345683",
    name: "Anti-Dandruff Shampoo 180ml",
    description: "Retail shampoo stock kept inactive for testing lifecycle handling.",
    unit: "BOTTLE",
    costPrice: "48.00",
    sellingPrice: "65.00",
    reorderLevel: 4,
    targetStockLevel: 12,
    status: "INACTIVE"
  },
  {
    id: "prd_dishwashing_liquid",
    categoryId: "cat_household_products",
    sku: "HSE-DISH-001",
    barcode: null,
    name: "Lemon Dishwashing Liquid",
    description: "Household cleaner without barcode to exercise optional lookup handling.",
    unit: "BOTTLE",
    costPrice: "14.00",
    sellingPrice: "19.00",
    reorderLevel: 7,
    targetStockLevel: 18,
    status: "ACTIVE"
  },
  {
    id: "prd_hand_sanitizer",
    categoryId: "cat_toiletries",
    sku: "TOI-SANI-001",
    barcode: "4800012345684",
    name: "Pocket Hand Sanitizer",
    description: "Legacy personal care item kept for historical traceability.",
    unit: "BOTTLE",
    costPrice: "26.00",
    sellingPrice: "34.00",
    reorderLevel: 5,
    targetStockLevel: 10,
    status: "INACTIVE"
  }
];

const movementSeeds = [
  {
    id: "mov_cola_initial",
    productId: "prd_cola_15l",
    inventoryId: "inv_cola_15l",
    type: "INITIAL_STOCK",
    quantity: 30,
    quantityBefore: 0,
    quantityAfter: 30,
    reason: "Opening stock for development validation.",
    referenceType: "SEED_INITIAL",
    referenceId: "COLA-INIT-001",
    createdAt: isoDate("2026-07-01T08:00:00.000Z")
  },
  {
    id: "mov_cola_stock_in",
    productId: "prd_cola_15l",
    inventoryId: "inv_cola_15l",
    type: "STOCK_IN",
    quantity: 10,
    quantityBefore: 30,
    quantityAfter: 40,
    reason: "Restock from supplier sample.",
    referenceType: "SEED_STOCK_IN",
    referenceId: "COLA-RS-001",
    createdAt: isoDate("2026-07-03T09:00:00.000Z")
  },
  {
    id: "mov_cola_sale",
    productId: "prd_cola_15l",
    inventoryId: "inv_cola_15l",
    type: "SALE",
    quantity: 12,
    quantityBefore: 40,
    quantityAfter: 28,
    reason: "POS sale sample for SARIMA-ready demand data.",
    referenceType: "SEED_SALE",
    referenceId: "SALE-20260704-001",
    createdAt: isoDate("2026-07-04T10:00:00.000Z")
  },
  {
    id: "mov_water_initial",
    productId: "prd_mineral_water_500ml",
    inventoryId: "inv_water_500ml",
    type: "INITIAL_STOCK",
    quantity: 8,
    quantityBefore: 0,
    quantityAfter: 8,
    reason: "Opening water stock.",
    referenceType: "SEED_INITIAL",
    referenceId: "WATER-INIT-001",
    createdAt: isoDate("2026-07-01T08:30:00.000Z")
  },
  {
    id: "mov_water_sale",
    productId: "prd_mineral_water_500ml",
    inventoryId: "inv_water_500ml",
    type: "SALE",
    quantity: 5,
    quantityBefore: 8,
    quantityAfter: 3,
    reason: "Cooling shelf demand sample.",
    referenceType: "SEED_SALE",
    referenceId: "SALE-20260705-001",
    createdAt: isoDate("2026-07-05T11:00:00.000Z")
  },
  {
    id: "mov_sardines_initial",
    productId: "prd_sardines_155g",
    inventoryId: "inv_sardines_155g",
    type: "INITIAL_STOCK",
    quantity: 15,
    quantityBefore: 0,
    quantityAfter: 15,
    reason: "Initial canned goods stock.",
    referenceType: "SEED_INITIAL",
    referenceId: "SARDINES-INIT-001",
    createdAt: isoDate("2026-07-01T09:00:00.000Z")
  },
  {
    id: "mov_sardines_sale",
    productId: "prd_sardines_155g",
    inventoryId: "inv_sardines_155g",
    type: "SALE",
    quantity: 15,
    quantityBefore: 15,
    quantityAfter: 0,
    reason: "Complete sample depletion.",
    referenceType: "SEED_SALE",
    referenceId: "SALE-20260706-001",
    createdAt: isoDate("2026-07-06T15:00:00.000Z")
  },
  {
    id: "mov_crackers_initial",
    productId: "prd_cheese_crackers",
    inventoryId: "inv_cheese_crackers",
    type: "INITIAL_STOCK",
    quantity: 18,
    quantityBefore: 0,
    quantityAfter: 18,
    reason: "Opening snacks stock.",
    referenceType: "SEED_INITIAL",
    referenceId: "CRACKERS-INIT-001",
    createdAt: isoDate("2026-07-01T09:30:00.000Z")
  },
  {
    id: "mov_crackers_stock_in",
    productId: "prd_cheese_crackers",
    inventoryId: "inv_cheese_crackers",
    type: "STOCK_IN",
    quantity: 2,
    quantityBefore: 18,
    quantityAfter: 20,
    reason: "Small replenishment sample.",
    referenceType: "SEED_STOCK_IN",
    referenceId: "CRACKERS-RS-001",
    createdAt: isoDate("2026-07-06T09:00:00.000Z")
  },
  {
    id: "mov_noodles_initial",
    productId: "prd_beef_noodles",
    inventoryId: "inv_beef_noodles",
    type: "INITIAL_STOCK",
    quantity: 6,
    quantityBefore: 0,
    quantityAfter: 6,
    reason: "Opening instant noodles stock.",
    referenceType: "SEED_INITIAL",
    referenceId: "NOODLES-INIT-001",
    createdAt: isoDate("2026-07-01T10:00:00.000Z")
  },
  {
    id: "mov_noodles_adjustment_out",
    productId: "prd_beef_noodles",
    inventoryId: "inv_beef_noodles",
    type: "ADJUSTMENT_OUT",
    quantity: 1,
    quantityBefore: 6,
    quantityAfter: 5,
    reason: "Shelf damage adjustment sample.",
    referenceType: "SEED_ADJUSTMENT",
    referenceId: "NOODLES-ADJ-001",
    createdAt: isoDate("2026-07-07T14:00:00.000Z")
  },
  {
    id: "mov_shampoo_initial",
    productId: "prd_shampoo_180ml",
    inventoryId: "inv_shampoo_180ml",
    type: "INITIAL_STOCK",
    quantity: 12,
    quantityBefore: 0,
    quantityAfter: 12,
    reason: "Inactive product still kept for historical traceability.",
    referenceType: "SEED_INITIAL",
    referenceId: "SHAMPOO-INIT-001",
    createdAt: isoDate("2026-07-01T10:30:00.000Z")
  },
  {
    id: "mov_shampoo_stock_in",
    productId: "prd_shampoo_180ml",
    inventoryId: "inv_shampoo_180ml",
    type: "STOCK_IN",
    quantity: 3,
    quantityBefore: 12,
    quantityAfter: 15,
    reason: "Sample replenishment for inactive test item.",
    referenceType: "SEED_STOCK_IN",
    referenceId: "SHAMPOO-RS-001",
    createdAt: isoDate("2026-07-08T13:00:00.000Z")
  },
  {
    id: "mov_dish_initial",
    productId: "prd_dishwashing_liquid",
    inventoryId: "inv_dishwashing_liquid",
    type: "INITIAL_STOCK",
    quantity: 4,
    quantityBefore: 0,
    quantityAfter: 4,
    reason: "Opening household stock.",
    referenceType: "SEED_INITIAL",
    referenceId: "DISH-INIT-001",
    createdAt: isoDate("2026-07-01T11:00:00.000Z")
  },
  {
    id: "mov_dish_stock_in",
    productId: "prd_dishwashing_liquid",
    inventoryId: "inv_dishwashing_liquid",
    type: "STOCK_IN",
    quantity: 4,
    quantityBefore: 4,
    quantityAfter: 8,
    reason: "Extra household replenishment sample.",
    referenceType: "SEED_STOCK_IN",
    referenceId: "DISH-RS-001",
    createdAt: isoDate("2026-07-08T14:00:00.000Z")
  },
  {
    id: "mov_dish_adjustment_out",
    productId: "prd_dishwashing_liquid",
    inventoryId: "inv_dishwashing_liquid",
    type: "ADJUSTMENT_OUT",
    quantity: 2,
    quantityBefore: 8,
    quantityAfter: 6,
    reason: "Manual correction after display count.",
    referenceType: "SEED_ADJUSTMENT",
    referenceId: "DISH-ADJ-001",
    createdAt: isoDate("2026-07-09T09:30:00.000Z")
  },
  {
    id: "mov_sanitizer_initial",
    productId: "prd_hand_sanitizer",
    inventoryId: "inv_hand_sanitizer",
    type: "INITIAL_STOCK",
    quantity: 5,
    quantityBefore: 0,
    quantityAfter: 5,
    reason: "Opening discontinued item stock.",
    referenceType: "SEED_INITIAL",
    referenceId: "SANI-INIT-001",
    createdAt: isoDate("2026-07-01T11:30:00.000Z")
  },
  {
    id: "mov_sanitizer_sale",
    productId: "prd_hand_sanitizer",
    inventoryId: "inv_hand_sanitizer",
    type: "SALE",
    quantity: 5,
    quantityBefore: 5,
    quantityAfter: 0,
    reason: "Historic sale for discontinued item.",
    referenceType: "SEED_SALE",
    referenceId: "SALE-20260710-001",
    createdAt: isoDate("2026-07-10T08:45:00.000Z")
  }
];

const inventoryRows = [
  {
    id: "inv_cola_15l",
    productId: "prd_cola_15l",
    quantityOnHand: 28,
    lastStockUpdatedAt: isoDate("2026-07-04T10:00:00.000Z"),
    version: 3
  },
  {
    id: "inv_water_500ml",
    productId: "prd_mineral_water_500ml",
    quantityOnHand: 3,
    lastStockUpdatedAt: isoDate("2026-07-05T11:00:00.000Z"),
    version: 2
  },
  {
    id: "inv_sardines_155g",
    productId: "prd_sardines_155g",
    quantityOnHand: 0,
    lastStockUpdatedAt: isoDate("2026-07-06T15:00:00.000Z"),
    version: 2
  },
  {
    id: "inv_cheese_crackers",
    productId: "prd_cheese_crackers",
    quantityOnHand: 20,
    lastStockUpdatedAt: isoDate("2026-07-06T09:00:00.000Z"),
    version: 2
  },
  {
    id: "inv_beef_noodles",
    productId: "prd_beef_noodles",
    quantityOnHand: 5,
    lastStockUpdatedAt: isoDate("2026-07-07T14:00:00.000Z"),
    version: 2
  },
  {
    id: "inv_shampoo_180ml",
    productId: "prd_shampoo_180ml",
    quantityOnHand: 15,
    lastStockUpdatedAt: isoDate("2026-07-08T13:00:00.000Z"),
    version: 2
  },
  {
    id: "inv_dishwashing_liquid",
    productId: "prd_dishwashing_liquid",
    quantityOnHand: 6,
    lastStockUpdatedAt: isoDate("2026-07-09T09:30:00.000Z"),
    version: 3
  },
  {
    id: "inv_hand_sanitizer",
    productId: "prd_hand_sanitizer",
    quantityOnHand: 0,
    lastStockUpdatedAt: isoDate("2026-07-10T08:45:00.000Z"),
    version: 2
  }
];

async function seedUsers() {
  const users = [
    {
      name: "Abarado",
      email: "owner@ysabellestore.local",
      password: "OwnerPass#2026",
      role: "OWNER"
    },
    {
      name: "Staff User",
      email: "staff@ysabellestore.local",
      password: "StaffPass#2026",
      role: "STAFF"
    }
  ];

  const seededUsers = [];

  for (const user of users) {
    const seededUser = await prisma.user.upsert({
      where: {
        email: user.email
      },
      create: {
        name: user.name,
        email: user.email,
        passwordHash: hashPassword(user.password, user.email),
        role: user.role,
        status: "ACTIVE"
      },
      update: {
        name: user.name,
        passwordHash: hashPassword(user.password, user.email),
        role: user.role,
        status: "ACTIVE"
      }
    });

    seededUsers.push(seededUser);
  }

  return {
    ownerUser: seededUsers.find((user) => user.role === "OWNER"),
    staffUser: seededUsers.find((user) => user.role === "STAFF")
  };
}

async function main() {
  const { ownerUser } = await seedUsers();
  const categoriesByCanonicalId = new Map();
  const productsByCanonicalId = new Map();

  for (const category of categories) {
    const seededCategory = await prisma.category.upsert({
      where: {
        slug: category.slug
      },
      create: {
        ...category
      },
      update: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        isActive: category.isActive
      }
    });

    categoriesByCanonicalId.set(category.id, seededCategory);
  }

  for (const product of products) {
    const seededCategory = categoriesByCanonicalId.get(product.categoryId);

    if (!seededCategory) {
      throw new Error(`Missing seeded category for product ${product.sku}.`);
    }

    const seededProduct = await prisma.product.upsert({
      where: {
        sku: product.sku
      },
      create: {
        id: product.id,
        categoryId: seededCategory.id,
        sku: product.sku,
        barcode: product.barcode,
        name: product.name,
        description: product.description,
        unit: product.unit,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        reorderLevel: product.reorderLevel,
        targetStockLevel: product.targetStockLevel,
        status: product.status
      },
      update: {
        categoryId: seededCategory.id,
        barcode: product.barcode,
        name: product.name,
        description: product.description,
        unit: product.unit,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        reorderLevel: product.reorderLevel,
        targetStockLevel: product.targetStockLevel,
        status: product.status
      }
    });

    productsByCanonicalId.set(product.id, seededProduct);
  }

  for (const inventory of inventoryRows) {
    const seededProduct = productsByCanonicalId.get(inventory.productId);

    if (!seededProduct) {
      throw new Error(`Missing seeded product for inventory row ${inventory.id}.`);
    }

    await prisma.inventory.upsert({
      where: {
        productId: seededProduct.id
      },
      create: {
        id: inventory.id,
        productId: seededProduct.id,
        quantityOnHand: inventory.quantityOnHand,
        lastStockUpdatedAt: inventory.lastStockUpdatedAt,
        version: inventory.version
      },
      update: {
        quantityOnHand: inventory.quantityOnHand,
        lastStockUpdatedAt: inventory.lastStockUpdatedAt,
        version: inventory.version
      }
    });
  }

  for (const movement of movementSeeds) {
    const seededProduct = productsByCanonicalId.get(movement.productId);

    if (!seededProduct) {
      throw new Error(`Missing seeded product for movement ${movement.id}.`);
    }

    await prisma.inventoryMovement.upsert({
      where: {
        id: movement.id
      },
      create: {
        id: movement.id,
        inventoryId: movement.inventoryId,
        productId: seededProduct.id,
        type: movement.type,
        quantity: movement.quantity,
        quantityBefore: movement.quantityBefore,
        quantityAfter: movement.quantityAfter,
        reason: movement.reason,
        referenceType: movement.referenceType,
        referenceId: movement.referenceId,
        performedById: ownerUser?.id ?? null,
        createdAt: movement.createdAt
      },
      update: {
        inventoryId: movement.inventoryId,
        productId: seededProduct.id,
        type: movement.type,
        quantity: movement.quantity,
        quantityBefore: movement.quantityBefore,
        quantityAfter: movement.quantityAfter,
        reason: movement.reason,
        referenceType: movement.referenceType,
        referenceId: movement.referenceId,
        performedById: ownerUser?.id ?? null
      }
    });
  }

  console.info("Development product and inventory seed data are ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
