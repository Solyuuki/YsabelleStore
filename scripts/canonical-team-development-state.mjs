#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

const ROOT = resolve(".");
const STATE_PATH = join(ROOT, "database", "prisma", "state", "canonical-state.json");
const TEAM_FIXTURE_DATE = new Date("2026-09-23T12:00:00.000Z");
const QA_REFERENCE = "QA_VERIFIED_50_STOCK_V2";
const TEAM_REFERENCE_TYPE = "TEAM_DEV_FIXTURE";

export const TEAM_DEVELOPMENT_ACCOUNTS = [
  {
    id: "team-owner-v1",
    name: "Abarado",
    email: "owner@ysabellestore.local",
    role: "OWNER",
    passwordHash:
      "scrypt$16384$8$1$a75538b5ebda853d10a2ef7c9355e89f$JsXlx4wKFTLTN/Sh3WSNXpObDk8dVzBg8DZbFz2GdnaLzvZavH3i3MChYR4n7JEgYo+DpTvc6lFRuPt/eVY9cA=="
  },
  {
    id: "team-staff-v1",
    name: "Staff User",
    email: "staff@ysabellestore.local",
    role: "STAFF",
    passwordHash:
      "scrypt$16384$8$1$8970dc8a993743af2ee5ff7e45b175fe$JggkCQlru7gTzu+oG9pzJlh0E3hL+2M6oFJPm3aJBz7TJjl1RaYPhSJGstXxLbT681KLCGxyYJiYzfbLZZX7lw=="
  }
];

export function expectedTeamStockQuantity(sourceProductId) {
  const match = String(sourceProductId).match(/^P(\d{3})$/);
  if (!match) throw new Error("Invalid canonical source product id: " + sourceProductId);
  return 12 + (Number(match[1]) % 18);
}

export function teamBatchCode(sku) {
  return `QA50-${sku}-20260923`;
}

export function shouldSyncDevelopmentTeamState(environment = process.env) {
  if (environment.NODE_ENV === "production") return false;
  if (environment.YSABELLE_TEAM_DEV_STATE_SYNC === "0") return false;
  const databaseUrl = environment.DATABASE_URL;
  if (!databaseUrl) return false;
  try {
    const parsed = new URL(databaseUrl);
    return (
      parsed.protocol === "mysql:" &&
      ["localhost", "127.0.0.1"].includes(parsed.hostname) &&
      Boolean(parsed.pathname.replace(/^\//, ""))
    );
  } catch {
    return false;
  }
}

function loadRelease() {
  const state = JSON.parse(readFileSync(STATE_PATH, "utf8"));
  const release = JSON.parse(readFileSync(join(ROOT, state.canonicalReleasePath), "utf8"));
  if (release.expectedProducts !== 50 || release.products?.length !== 50) {
    throw new Error("Development team state requires the canonical production-50 release.");
  }
  return release;
}

async function upsertTeamUsers(transaction) {
  const users = [];
  for (const account of TEAM_DEVELOPMENT_ACCOUNTS) {
    users.push(
      await transaction.user.upsert({
        where: { email: account.email },
        create: {
          id: account.id,
          name: account.name,
          email: account.email,
          passwordHash: account.passwordHash,
          role: account.role,
          status: "ACTIVE"
        },
        update: {
          name: account.name,
          passwordHash: account.passwordHash,
          role: account.role,
          status: "ACTIVE"
        }
      })
    );
  }
  return users;
}

async function convergeProductStock(transaction, product, ownerUserId) {
  const quantity = expectedTeamStockQuantity(product.sourceProductId);
  const batchCode = teamBatchCode(product.sku);
  const inventory = await transaction.inventory.upsert({
    where: { productId: product.productId },
    create: {
      id: `team-inv-${product.sourceProductId.toLowerCase()}`,
      productId: product.productId,
      quantityOnHand: quantity,
      lastStockUpdatedAt: TEAM_FIXTURE_DATE,
      version: 1
    },
    update: {
      quantityOnHand: quantity,
      lastStockUpdatedAt: TEAM_FIXTURE_DATE,
      version: 1
    }
  });

  await transaction.inventoryBatch.updateMany({
    where: {
      productId: product.productId,
      batchCode: { not: batchCode }
    },
    data: {
      quantityRemaining: 0,
      status: "DEPLETED"
    }
  });

  const batch = await transaction.inventoryBatch.upsert({
    where: {
      productId_batchCode: {
        productId: product.productId,
        batchCode
      }
    },
    create: {
      id: `team-batch-${product.sourceProductId.toLowerCase()}-v1`,
      productId: product.productId,
      batchCode,
      quantityReceived: quantity,
      quantityRemaining: quantity,
      unitCost: null,
      receivedAt: TEAM_FIXTURE_DATE,
      expiresAt: null,
      status: "AVAILABLE"
    },
    update: {
      quantityReceived: quantity,
      quantityRemaining: quantity,
      unitCost: null,
      receivedAt: TEAM_FIXTURE_DATE,
      expiresAt: null,
      status: "AVAILABLE"
    }
  });

  const existingMovement = await transaction.inventoryMovement.findFirst({
    where: {
      productId: product.productId,
      referenceId: QA_REFERENCE
    },
    orderBy: { createdAt: "asc" }
  });
  const movementData = {
    inventoryId: inventory.id,
    productId: product.productId,
    batchId: batch.id,
    performedById: ownerUserId,
    type: "INITIAL_STOCK",
    quantity,
    quantityBefore: 0,
    quantityAfter: quantity,
    reason: "Verified-50 baseline stock seed.",
    referenceType: TEAM_REFERENCE_TYPE,
    referenceId: QA_REFERENCE,
    createdAt: TEAM_FIXTURE_DATE
  };

  if (existingMovement) {
    await transaction.inventoryMovement.update({
      where: { id: existingMovement.id },
      data: movementData
    });
  } else {
    await transaction.inventoryMovement.create({
      data: {
        id: `team-movement-${product.sourceProductId.toLowerCase()}-v1`,
        ...movementData
      }
    });
  }
}

export async function verifyDevelopmentTeamState(prisma) {
  const release = loadRelease();
  const findings = [];

  for (const account of TEAM_DEVELOPMENT_ACCOUNTS) {
    const user = await prisma.user.findUnique({ where: { email: account.email } });
    if (
      !user ||
      user.passwordHash !== account.passwordHash ||
      user.role !== account.role ||
      user.status !== "ACTIVE"
    ) {
      findings.push("auth:" + account.email);
    }
  }

  for (const product of release.products) {
    const quantity = expectedTeamStockQuantity(product.sourceProductId);
    const batchCode = teamBatchCode(product.sku);
    const [inventory, batches, movementCount] = await Promise.all([
      prisma.inventory.findUnique({ where: { productId: product.productId } }),
      prisma.inventoryBatch.findMany({
        where: {
          productId: product.productId,
          quantityRemaining: { gt: 0 },
          status: { in: ["AVAILABLE", "LOW_STOCK"] }
        }
      }),
      prisma.inventoryMovement.count({
        where: {
          productId: product.productId,
          referenceId: QA_REFERENCE
        }
      })
    ]);
    const sellable = batches.reduce((sum, batch) => sum + batch.quantityRemaining, 0);
    const teamBatch = batches.find((batch) => batch.batchCode === batchCode);

    if (
      !inventory ||
      inventory.quantityOnHand !== quantity ||
      sellable !== quantity ||
      !teamBatch ||
      teamBatch.quantityRemaining !== quantity ||
      movementCount < 1
    ) {
      findings.push("stock:" + product.sourceProductId);
    }
  }

  return findings;
}

export async function syncDevelopmentTeamState(prisma) {
  if (!shouldSyncDevelopmentTeamState()) {
    return { status: "SKIPPED", users: 0, products: 0 };
  }
  const release = loadRelease();
  await prisma.$transaction(
    async (transaction) => {
      const users = await upsertTeamUsers(transaction);
      const owner = users.find((user) => user.role === "OWNER");
      if (!owner) throw new Error("Development team owner fixture is missing.");
      for (const product of release.products) {
        await convergeProductStock(transaction, product, owner.id);
      }
    },
    { maxWait: 10_000, timeout: 120_000 }
  );

  const findings = await verifyDevelopmentTeamState(prisma);
  if (findings.length) {
    throw new Error("Development team state verification failed: " + findings.join(", "));
  }
  return {
    status: "SYNCED",
    users: TEAM_DEVELOPMENT_ACCOUNTS.length,
    products: release.products.length
  };
}

async function main() {
  if (!shouldSyncDevelopmentTeamState()) {
    console.log("TEAM_DEVELOPMENT_STATE=SKIPPED");
    return;
  }

  const prisma = new PrismaClient();
  try {
    if (process.argv.includes("--verify-only")) {
      const findings = await verifyDevelopmentTeamState(prisma);
      if (findings.length) throw new Error(findings.join(", "));
      console.log("TEAM_DEVELOPMENT_STATE_VERIFY=PASS users=2 products=50");
      return;
    }

    const result = await syncDevelopmentTeamState(prisma);
    console.log(
      `TEAM_DEVELOPMENT_STATE_SYNC=PASS users=${result.users} products=${result.products}`
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error("TEAM_DEVELOPMENT_STATE=ERROR");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
