import { randomUUID } from "node:crypto";

import {
  InventoryBatchStatus,
  InventoryMovementType,
  type Prisma,
  type PrismaClient
} from "@prisma/client";

import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import { serializeInventory, type InventorySummaryRow } from "./catalogSerializers.js";

type TransactionClient = Prisma.TransactionClient | PrismaClient;

type InventoryWithRelations = Parameters<typeof serializeInventory>[0];

type BatchStockOptions = {
  sellableOnly?: boolean;
};

type BatchAllocation = {
  batchId: string;
  quantity: number;
  unitCost: Prisma.Decimal;
};

const movementInclude = {
  inventory: true,
  product: {
    include: {
      category: true
    }
  },
  performedBy: true
} as const;

function toDateKey(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null;
}

async function getProductContext(tx: TransactionClient, productId: string) {
  const product = await tx.product.findUnique({
    include: {
      category: true,
      inventory: true,
      inventoryBatches: true
    },
    where: {
      id: productId
    }
  });

  if (!product) {
    throw new HttpError(404, "Product not found.", {
      code: "PRODUCT_NOT_FOUND"
    });
  }

  return product;
}

async function getOrCreateInventory(tx: TransactionClient, productId: string) {
  const inventory = await tx.inventory.findUnique({
    include: {
      product: {
        include: {
          category: true
        }
      }
    },
    where: {
      productId
    }
  });

  if (inventory) {
    return inventory;
  }

  return tx.inventory.create({
    data: {
      productId,
      quantityOnHand: 0,
      version: 0
    },
    include: {
      product: {
        include: {
          category: true
        }
      }
    }
  });
}

function isSellableBatchStatus(status: InventoryBatchStatus) {
  return status === InventoryBatchStatus.AVAILABLE || status === InventoryBatchStatus.LOW_STOCK;
}

function isExpired(batch: { expiresAt: Date | null }) {
  return batch.expiresAt !== null && batch.expiresAt.getTime() < Date.now();
}

function getPhysicalBatchTotal(
  batches: Array<{
    quantityRemaining: number;
    status: InventoryBatchStatus;
  }>,
  options: BatchStockOptions = {}
) {
  return batches.reduce((total, batch) => {
    if (batch.quantityRemaining <= 0) {
      return total;
    }

    if (options.sellableOnly && !isSellableBatchStatus(batch.status)) {
      return total;
    }

    return total + batch.quantityRemaining;
  }, 0);
}

function asInventorySummary(inventory: InventoryWithRelations): InventorySummaryRow {
  return serializeInventory(inventory);
}

function normalizeReconciliationToken(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function formatReconciliationStamp(date: Date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

export function buildReconciliationIdentifiers(sku: string, repairDate = new Date()) {
  const token = normalizeReconciliationToken(sku);
  const stamp = formatReconciliationStamp(repairDate);

  return {
    batchCode: `RECON-${token}-${stamp}`,
    referenceId: `RECON-${token}`,
    token
  };
}

async function syncInventoryAggregate(tx: TransactionClient, productId: string) {
  const product = await getProductContext(tx, productId);
  const inventory = await getOrCreateInventory(tx, productId);
  const batchTotal = getPhysicalBatchTotal(product.inventoryBatches);

  const updatedInventory = await tx.inventory.update({
    data: {
      quantityOnHand: batchTotal,
      lastStockUpdatedAt: new Date(),
      version: {
        increment: 1
      }
    },
    include: {
      product: {
        include: {
          category: true
        }
      }
    },
    where: {
      id: inventory.id
    }
  });

  return {
    batchTotal,
    inventory: asInventorySummary(updatedInventory)
  };
}

export async function calculateBatchStock(
  tx: TransactionClient,
  productId: string,
  options: BatchStockOptions = {}
) {
  const product = await getProductContext(tx, productId);

  return getPhysicalBatchTotal(product.inventoryBatches, options);
}

export async function calculateSellableStock(tx: TransactionClient, productId: string) {
  const product = await getProductContext(tx, productId);

  return getPhysicalBatchTotal(product.inventoryBatches, {
    sellableOnly: true
  });
}

export async function synchronizeInventoryAggregate(tx: TransactionClient, productId: string) {
  return syncInventoryAggregate(tx, productId);
}

export async function assertStockInvariant(tx: TransactionClient, productId: string) {
  const product = await getProductContext(tx, productId);
  const inventory = await getOrCreateInventory(tx, productId);
  const batchTotal = getPhysicalBatchTotal(product.inventoryBatches);

  if (inventory.quantityOnHand !== batchTotal) {
    throw new HttpError(409, "Inventory stock is out of sync with batch stock.", {
      code: "STOCK_INVARIANT_BROKEN",
      details: {
        batchTotal,
        inventoryQuantityOnHand: inventory.quantityOnHand,
        productId
      }
    });
  }
}

export async function reconcileProductStock(tx: TransactionClient, productId: string) {
  const product = await getProductContext(tx, productId);
  const inventory = await getOrCreateInventory(tx, productId);
  const batchTotal = getPhysicalBatchTotal(product.inventoryBatches);

  if (inventory.quantityOnHand === batchTotal) {
    return {
      inventory: asInventorySummary(inventory),
      repaired: false
    };
  }

  const updatedInventory = await tx.inventory.update({
    data: {
      quantityOnHand: batchTotal,
      lastStockUpdatedAt: new Date(),
      version: {
        increment: 1
      }
    },
    include: {
      product: {
        include: {
          category: true
        }
      }
    },
    where: {
      id: inventory.id
    }
  });

  return {
    inventory: asInventorySummary(updatedInventory),
    repaired: true
  };
}

export async function createOpeningStockBatch(
  tx: TransactionClient,
  input: {
    productId: string;
    sku: string;
    quantity: number;
    unitCost: Prisma.Decimal;
    performedById?: string;
    reason?: string | null;
    referenceId?: string | null;
  }
) {
  if (input.quantity <= 0) {
    return null;
  }

  const batchCode = `OPENING-${input.sku}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const product = await getProductContext(tx, input.productId);
  const inventory = await getOrCreateInventory(tx, input.productId);

  const batch = await tx.inventoryBatch.create({
    data: {
      batchCode,
      expiresAt: null,
      productId: input.productId,
      quantityReceived: input.quantity,
      quantityRemaining: input.quantity,
      receivedAt: new Date(),
      status: InventoryBatchStatus.AVAILABLE,
      unitCost: input.unitCost
    }
  });

  const syncResult = await syncInventoryAggregate(tx, product.id);

  const movement = await tx.inventoryMovement.create({
    data: {
      batchId: batch.id,
      inventoryId: inventory.id,
      performedById: input.performedById,
      productId: input.productId,
      quantity: input.quantity,
      quantityBefore: 0,
      quantityAfter: syncResult.batchTotal,
      reason: input.reason ?? "Opening stock created during product setup.",
      referenceId: input.referenceId,
      referenceType: "OPENING_STOCK",
      type: InventoryMovementType.INITIAL_STOCK
    },
    include: movementInclude
  });

  await assertStockInvariant(tx, input.productId);

  return {
    batch,
    inventory: syncResult.inventory,
    movement
  };
}

export async function stockInBatch(
  tx: TransactionClient,
  input: {
    productId: string;
    quantity: number;
    unitCost?: Prisma.Decimal;
    expiresAt?: Date | null;
    batchCode?: string | null;
    performedById?: string;
    reason?: string | null;
    referenceId?: string | null;
    referenceType?: string | null;
  }
) {
  if (input.quantity <= 0) {
    throw new HttpError(400, "Stock-in quantity must be greater than zero.", {
      code: "INVALID_STOCK_IN_QUANTITY"
    });
  }

  const product = await getProductContext(tx, input.productId);
  const inventory = await getOrCreateInventory(tx, input.productId);
  const batchCode =
    input.batchCode?.trim() || `STOCKIN-${product.sku}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const expiresAt = input.expiresAt ?? null;
  const existingBatch = await tx.inventoryBatch.findFirst({
    where: {
      batchCode,
      productId: product.id
    }
  });

  if (existingBatch && toDateKey(existingBatch.expiresAt) !== toDateKey(expiresAt)) {
    throw new HttpError(409, "The batch code is already linked to a different expiration date.", {
      code: "BATCH_EXPIRATION_CONFLICT"
    });
  }

  const batch = existingBatch
    ? await tx.inventoryBatch.update({
        data: {
          quantityReceived: existingBatch.quantityReceived + input.quantity,
          quantityRemaining: existingBatch.quantityRemaining + input.quantity,
          status: InventoryBatchStatus.AVAILABLE
        },
        where: {
          id: existingBatch.id
        }
      })
    : await tx.inventoryBatch.create({
        data: {
          batchCode,
          expiresAt,
          productId: product.id,
          quantityReceived: input.quantity,
          quantityRemaining: input.quantity,
          receivedAt: new Date(),
          status: InventoryBatchStatus.AVAILABLE,
          unitCost: input.unitCost ?? product.costPrice
        }
      });

  const syncResult = await syncInventoryAggregate(tx, product.id);

  const movement = await tx.inventoryMovement.create({
    data: {
      batchId: batch.id,
      inventoryId: inventory.id,
      performedById: input.performedById,
      productId: product.id,
      quantity: input.quantity,
      quantityBefore: syncResult.batchTotal - input.quantity,
      quantityAfter: syncResult.batchTotal,
      reason: input.reason ?? "Stock-in recorded.",
      referenceId: input.referenceId,
      referenceType: input.referenceType ?? "STOCK_IN",
      type: InventoryMovementType.STOCK_IN
    },
    include: movementInclude
  });

  await assertStockInvariant(tx, input.productId);

  return {
    batch,
    batchCreated: existingBatch === null,
    inventory: syncResult.inventory,
    movement
  };
}

export async function applyStockAdjustment(
  tx: TransactionClient,
  input: {
    productId: string;
    quantity: number;
    direction: "IN" | "OUT";
    performedById?: string;
    reason: string;
    referenceId?: string | null;
    referenceType?: string | null;
  }
) {
  const product = await getProductContext(tx, input.productId);
  const inventory = await getOrCreateInventory(tx, input.productId);

  if (input.direction === "IN") {
    const batchCode = `ADJIN-${product.sku}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const batch = await tx.inventoryBatch.create({
      data: {
        batchCode,
        expiresAt: null,
        productId: product.id,
        quantityReceived: input.quantity,
        quantityRemaining: input.quantity,
        receivedAt: new Date(),
        status: InventoryBatchStatus.AVAILABLE,
        unitCost: product.costPrice
      }
    });

    const syncResult = await syncInventoryAggregate(tx, product.id);

    const movement = await tx.inventoryMovement.create({
      data: {
        batchId: batch.id,
        inventoryId: inventory.id,
        performedById: input.performedById,
        productId: product.id,
        quantity: input.quantity,
        quantityBefore: syncResult.batchTotal - input.quantity,
        quantityAfter: syncResult.batchTotal,
        reason: input.reason,
        referenceId: input.referenceId,
        referenceType: input.referenceType ?? "ADJUSTMENT",
        type: InventoryMovementType.ADJUSTMENT_IN
      },
      include: movementInclude
    });

    await assertStockInvariant(tx, input.productId);

    return {
      inventory: syncResult.inventory,
      movement
    };
  }

  const allocations = await allocateStockForSale(tx, {
    productId: product.id,
    quantity: input.quantity
  });

  const syncResult = await syncInventoryAggregate(tx, product.id);

  const movement = await tx.inventoryMovement.create({
    data: {
      batchId: allocations[0]?.batchId ?? null,
      inventoryId: inventory.id,
      performedById: input.performedById,
      productId: product.id,
      quantity: input.quantity,
      quantityBefore: syncResult.batchTotal + input.quantity,
      quantityAfter: syncResult.batchTotal,
      reason: input.reason,
      referenceId: input.referenceId,
      referenceType: input.referenceType ?? "ADJUSTMENT",
      type: InventoryMovementType.ADJUSTMENT_OUT
    },
    include: movementInclude
  });

  await assertStockInvariant(tx, input.productId);

  return {
    inventory: syncResult.inventory,
    movement
  };
}

export async function allocateStockForSale(
  tx: TransactionClient,
  input: {
    productId: string;
    quantity: number;
  }
) {
  const product = await getProductContext(tx, input.productId);
  const batches = product.inventoryBatches
    .filter((batch) => batch.quantityRemaining > 0)
    .filter((batch) => batch.status !== InventoryBatchStatus.REMOVED)
    .filter((batch) => batch.status !== InventoryBatchStatus.EXPIRED)
    .filter((batch) => !isExpired(batch))
    .sort((left, right) => {
      const leftExpiry = left.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;
      const rightExpiry = right.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;

      if (leftExpiry !== rightExpiry) {
        return leftExpiry - rightExpiry;
      }

      const createdAtComparison = left.createdAt.getTime() - right.createdAt.getTime();

      if (createdAtComparison !== 0) {
        return createdAtComparison;
      }

      return left.id.localeCompare(right.id);
    });

  const sellableStock = getPhysicalBatchTotal(product.inventoryBatches, {
    sellableOnly: true
  });

  if (input.quantity > sellableStock) {
    throw new HttpError(409, "Insufficient sellable stock for checkout.", {
      code: "INSUFFICIENT_STOCK",
      details: {
        available: sellableStock,
        productId: input.productId,
        requested: input.quantity
      }
    });
  }

  let remainingQuantity = input.quantity;
  const allocations: BatchAllocation[] = [];

  for (const batch of batches) {
    if (remainingQuantity <= 0) {
      break;
    }

    const allocatedQuantity = Math.min(batch.quantityRemaining, remainingQuantity);

    if (allocatedQuantity <= 0) {
      continue;
    }

    const nextRemaining = batch.quantityRemaining - allocatedQuantity;
    const nextStatus =
      nextRemaining <= 0
        ? InventoryBatchStatus.DEPLETED
        : nextRemaining <= product.reorderLevel
          ? InventoryBatchStatus.LOW_STOCK
          : InventoryBatchStatus.AVAILABLE;

    await tx.inventoryBatch.update({
      data: {
        quantityRemaining: nextRemaining,
        status: nextStatus
      },
      where: {
        id: batch.id
      }
    });

    allocations.push({
      batchId: batch.id,
      quantity: allocatedQuantity,
      unitCost: batch.unitCost
    });
    remainingQuantity -= allocatedQuantity;
  }

  if (remainingQuantity > 0) {
    throw new HttpError(409, "Unable to allocate enough stock for checkout.", {
      code: "INSUFFICIENT_STOCK"
    });
  }

  return allocations;
}

export async function createInventoryMovementAfterAllocation(
  tx: TransactionClient,
  input: {
    productId: string;
    batchId?: string | null;
    quantity: number;
    quantityBefore: number;
    quantityAfter: number;
    inventoryId: string;
    performedById?: string;
    reason?: string | null;
    referenceId?: string | null;
    referenceType?: string | null;
    type: InventoryMovementType;
  }
) {
  return tx.inventoryMovement.create({
    data: {
      batchId: input.batchId ?? null,
      inventoryId: input.inventoryId,
      performedById: input.performedById,
      productId: input.productId,
      quantity: input.quantity,
      quantityBefore: input.quantityBefore,
      quantityAfter: input.quantityAfter,
      reason: input.reason ?? null,
      referenceId: input.referenceId,
      referenceType: input.referenceType ?? null,
      type: input.type
    },
    include: movementInclude
  });
}

export async function reconcileLegacyStockMismatch(
  tx: TransactionClient,
  input: {
    productId: string;
    sku: string;
    quantity: number;
    performedById?: string | null;
    reason?: string | null;
    referenceType?: string | null;
    repairDate?: Date;
  }
) {
  if (input.quantity <= 0) {
    return {
      batch: null,
      createdBatch: false,
      createdMovement: false,
      inventory: await getInventorySummary(tx, input.productId),
      movement: null
    };
  }

  const product = await getProductContext(tx, input.productId);
  const inventory = await getOrCreateInventory(tx, input.productId);
  const identifiers = buildReconciliationIdentifiers(input.sku, input.repairDate);
  const batchPrefix = `RECON-${identifiers.token}-`;
  const existingBatch = await tx.inventoryBatch.findFirst({
    orderBy: [
      {
        createdAt: "asc"
      },
      {
        id: "asc"
      }
    ],
    where: {
      batchCode: {
        startsWith: batchPrefix
      },
      productId: input.productId
    }
  });
  const existingMovement = await tx.inventoryMovement.findFirst({
    orderBy: [
      {
        createdAt: "asc"
      },
      {
        id: "asc"
      }
    ],
    where: {
      productId: input.productId,
      referenceId: identifiers.referenceId,
      referenceType: input.referenceType ?? "STOCK_RECONCILIATION"
    }
  });
  const currentBatchTotal = getPhysicalBatchTotal(product.inventoryBatches);
  const movementBefore = existingBatch ? currentBatchTotal - input.quantity : currentBatchTotal;
  const movementAfter = movementBefore + input.quantity;

  if (existingBatch && existingBatch.quantityRemaining !== input.quantity) {
    throw new HttpError(
      409,
      "Existing reconciliation batch does not match the expected quantity.",
      {
        code: "RECONCILIATION_BATCH_MISMATCH",
        details: {
          expectedQuantity: input.quantity,
          productId: input.productId,
          reconciliationBatchCode: existingBatch.batchCode,
          actualQuantity: existingBatch.quantityRemaining
        }
      }
    );
  }

  if (existingMovement && existingMovement.quantity !== input.quantity) {
    throw new HttpError(
      409,
      "Existing reconciliation movement does not match the expected quantity.",
      {
        code: "RECONCILIATION_MOVEMENT_MISMATCH",
        details: {
          expectedQuantity: input.quantity,
          productId: input.productId,
          referenceId: identifiers.referenceId,
          actualQuantity: existingMovement.quantity
        }
      }
    );
  }

  let batch = existingBatch;
  let createdBatch = false;

  if (!batch) {
    batch = await tx.inventoryBatch.create({
      data: {
        batchCode: identifiers.batchCode,
        expiresAt: null,
        productId: input.productId,
        quantityReceived: input.quantity,
        quantityRemaining: input.quantity,
        receivedAt: input.repairDate ?? new Date(),
        status: InventoryBatchStatus.AVAILABLE,
        unitCost: product.costPrice
      }
    });
    createdBatch = true;
  }

  let movement = existingMovement;
  let createdMovement = false;

  if (!movement) {
    movement = await tx.inventoryMovement.create({
      data: {
        batchId: batch.id,
        inventoryId: inventory.id,
        performedById: input.performedById ?? null,
        productId: input.productId,
        quantity: input.quantity,
        quantityBefore: movementBefore,
        quantityAfter: movementAfter,
        reason: input.reason ?? "Reconciled legacy inventory and batch stock mismatch.",
        referenceId: identifiers.referenceId,
        referenceType: input.referenceType ?? "STOCK_RECONCILIATION",
        type: InventoryMovementType.ADJUSTMENT_IN
      },
      include: movementInclude
    });
    createdMovement = true;
  }

  if (createdBatch) {
    await synchronizeInventoryAggregate(tx, product.id);
  }

  await assertStockInvariant(tx, input.productId);

  return {
    batch,
    createdBatch,
    createdMovement,
    inventory: await getInventorySummary(tx, input.productId),
    movement
  };
}

export async function getInventorySummary(tx: TransactionClient, productId: string) {
  const inventory = await getOrCreateInventory(tx, productId);

  return asInventorySummary(inventory);
}

export type StockAuditRow = {
  difference: number;
  invariantStatus: "OK" | "MISMATCH";
  productId: string;
  sku: string;
  batchTotal: number;
  quantityOnHand: number;
};

export async function auditStock(tx: TransactionClient = prisma): Promise<StockAuditRow[]> {
  const inventoryRows = await tx.inventory.findMany({
    include: {
      product: {
        include: {
          inventoryBatches: true
        }
      }
    },
    orderBy: [
      {
        productId: "asc"
      }
    ]
  });

  return inventoryRows.map((inventory) => {
    const batchTotal = inventory.product.inventoryBatches.reduce(
      (total, batch) => total + batch.quantityRemaining,
      0
    );
    const difference = inventory.quantityOnHand - batchTotal;

    return {
      batchTotal,
      difference,
      invariantStatus: difference === 0 ? "OK" : "MISMATCH",
      productId: inventory.productId,
      quantityOnHand: inventory.quantityOnHand,
      sku: inventory.product.sku
    };
  });
}
