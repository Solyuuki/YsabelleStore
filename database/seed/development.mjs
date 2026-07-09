import { randomBytes, scryptSync } from "node:crypto";
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

function hashPassword(password) {
  const salt = randomBytes(16).toString("base64");
  const derivedKey = scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAX_MEMORY
  });

  return ["scrypt", SCRYPT_N, SCRYPT_R, SCRYPT_P, salt, derivedKey.toString("base64")].join("$");
}

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

const categories = [
  {
    name: "Pantry",
    slug: "pantry",
    description: "Shelf-stable grocery items"
  },
  {
    name: "Beverages",
    slug: "beverages",
    description: "Drinks and hydration items"
  }
];

const products = [
  {
    barcode: "4800041123456",
    batchCode: "PANTRY-UBE-001",
    categorySlug: "pantry",
    name: "Ube Condensed Milk",
    quantityRemaining: 18,
    reorderLevel: 6,
    sku: "PAN-UBE-001",
    sellingPrice: "89.50",
    unitCost: "63.00"
  },
  {
    barcode: "4800041123463",
    batchCode: "BEV-WATER-001",
    categorySlug: "beverages",
    name: "Mineral Water 500mL",
    quantityRemaining: 36,
    reorderLevel: 12,
    sku: "BEV-WAT-500",
    sellingPrice: "18.00",
    unitCost: "10.50"
  },
  {
    barcode: "4800041123470",
    batchCode: "PAN-BREAD-001",
    categorySlug: "pantry",
    name: "Classic Bread Loaf",
    quantityRemaining: 0,
    reorderLevel: 10,
    sku: "PAN-BRD-001",
    sellingPrice: "45.00",
    unitCost: "29.00"
  }
];

async function main() {
  for (const user of users) {
    await prisma.user.upsert({
      where: {
        email: user.email
      },
      create: {
        name: user.name,
        email: user.email,
        passwordHash: hashPassword(user.password),
        role: user.role,
        status: "ACTIVE"
      },
      update: {
        name: user.name,
        passwordHash: hashPassword(user.password),
        role: user.role,
        status: "ACTIVE"
      }
    });
  }

  const categoryRecords = new Map();

  for (const category of categories) {
    const record = await prisma.category.upsert({
      where: {
        slug: category.slug
      },
      create: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        isActive: true
      },
      update: {
        name: category.name,
        description: category.description,
        isActive: true
      }
    });

    categoryRecords.set(category.slug, record);
  }

  for (const product of products) {
    const category = categoryRecords.get(product.categorySlug);

    if (!category) {
      continue;
    }

    const record = await prisma.product.upsert({
      where: {
        sku: product.sku
      },
      create: {
        categoryId: category.id,
        sku: product.sku,
        barcode: product.barcode,
        name: product.name,
        description: null,
        unit: "PIECE",
        costPrice: product.unitCost,
        sellingPrice: product.sellingPrice,
        reorderLevel: product.reorderLevel,
        targetStockLevel: product.reorderLevel * 2,
        isActive: true
      },
      update: {
        categoryId: category.id,
        barcode: product.barcode,
        name: product.name,
        description: null,
        unit: "PIECE",
        costPrice: product.unitCost,
        sellingPrice: product.sellingPrice,
        reorderLevel: product.reorderLevel,
        targetStockLevel: product.reorderLevel * 2,
        isActive: true
      }
    });

    await prisma.inventoryBatch.upsert({
      where: {
        productId_batchCode: {
          productId: record.id,
          batchCode: product.batchCode
        }
      },
      create: {
        productId: record.id,
        batchCode: product.batchCode,
        quantityReceived: product.quantityRemaining,
        quantityRemaining: product.quantityRemaining,
        unitCost: product.unitCost,
        expiresAt: null,
        status: product.quantityRemaining > 0 ? "AVAILABLE" : "DEPLETED"
      },
      update: {
        quantityReceived: product.quantityRemaining,
        quantityRemaining: product.quantityRemaining,
        unitCost: product.unitCost,
        expiresAt: null,
        status: product.quantityRemaining > 0 ? "AVAILABLE" : "DEPLETED"
      }
    });
  }

  console.info("Development auth seed users are ready.");
  console.info("Development POS catalog fixtures are ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
