import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "../src/database/prismaClient.js";
import { requireRole } from "../src/middleware/roleMiddleware.js";
import { addStock, adjustStock } from "../src/services/inventoryService.js";
import { checkoutPosSale, searchPosProducts } from "../src/services/posService.js";
import { changeProductStatus, createProduct } from "../src/services/productService.js";
import {
  importProductsFromFile,
  previewProductImport
} from "../src/services/productImportService.js";
import { auditStock } from "../src/services/stockDomainService.js";

type UploadedFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

let categoryId = "";

test.before(async () => {
  categoryId = await ensureCategoryId();
});

test.after(async () => {
  await prisma.$disconnect();
});

test(
  "create product with zero stock keeps inventory and batches aligned",
  { concurrency: false },
  async () => {
    const product = await createProduct(buildProductInput({ initialStock: 0 }));
    const state = await getStockState(product.id);

    assert.equal(state.inventory.quantityOnHand, 0);
    assert.equal(state.batchTotal, 0);
    assert.equal(state.movements.length, 0);
    assertInvariant(state);
  }
);

test(
  "create product with opening stock creates batch and movement",
  { concurrency: false },
  async () => {
    const product = await createProduct(buildProductInput({ initialStock: 10 }));
    const state = await getStockState(product.id);

    assert.equal(state.inventory.quantityOnHand, 10);
    assert.equal(state.batchTotal, 10);
    assert.equal(state.movements.length, 1);
    assert.equal(state.movements[0]?.type, "INITIAL_STOCK");
    assertInvariant(state);
  }
);

test(
  "create product rolls back when opening stock batch creation fails",
  { concurrency: false },
  async () => {
    const sku = uniqueSku("ROLLBACK");

    await withPatchedTransaction(
      (tx) => ({
        ...tx,
        inventoryBatch: {
          ...tx.inventoryBatch,
          create: (async () => {
            throw new Error("Synthetic opening batch failure.");
          }) as unknown as typeof tx.inventoryBatch.create
        }
      }),
      async () => {
        await assert.rejects(() =>
          createProduct(
            buildProductInput({
              initialStock: 5,
              sku
            })
          )
        );
      }
    );

    const product = await prisma.product.findUnique({
      where: { sku },
      include: {
        inventory: true,
        inventoryBatches: true,
        inventoryMovements: true
      }
    });

    assert.equal(product, null);
  }
);

test(
  "import product with stock creates opening batch and movement",
  { concurrency: false },
  async () => {
    const sku = uniqueSku("IMP");
    const categoryName = await resolveCategoryName();
    const file = csvFile(
      "import-stock.csv",
      [
        "name,sku,barcode,category,unit,costPrice,sellingPrice,reorderLevel,targetStockLevel,initialStock,status,description",
        `Imported ${uniqueLabel("Product")},${sku},${uniqueBarcode()},${categoryName},PIECE,10.00,15.00,2,5,7,ACTIVE,Imported row`
      ].join("\n")
    );

    const result = await importProductsFromFile(file);
    assert.equal(result.importedRows, 1);

    const product = await prisma.product.findUnique({
      where: { sku },
      include: {
        inventory: true,
        inventoryBatches: true,
        inventoryMovements: true
      }
    });

    assert.ok(product);
    assert.equal(product?.inventory?.quantityOnHand, 7);
    assert.equal(
      product?.inventoryBatches.reduce((sum, batch) => sum + batch.quantityRemaining, 0),
      7
    );
    assert.equal(product?.inventoryMovements.length, 1);
    assertInvariant(await getStockState(product!.id));
  }
);

test("import preview rejects invalid headers", { concurrency: false }, async () => {
  const preview = await previewProductImport(
    csvFile(
      "bad-headers.csv",
      [
        "name,sku,category,unit,costPrice,sellingPrice,reorderLevel,initialStock,initialStock",
        "Missing,SKU,Category,PIECE,1.00,2.00,0,0,0"
      ].join("\n")
    )
  );

  assert.ok(preview.errors.some((issue) => issue.code === "DUPLICATE_HEADER"));
});

test("import preview rejects duplicate SKU", { concurrency: false }, async () => {
  const sku = uniqueSku("DUPSKU");
  const categoryName = await resolveCategoryName();
  const preview = await previewProductImport(
    csvFile(
      "dup-sku.csv",
      [
        "name,sku,barcode,category,unit,costPrice,sellingPrice,reorderLevel,targetStockLevel,initialStock,status,description",
        `Row 1,${sku},${uniqueBarcode()},${categoryName},PIECE,1.00,2.00,0,0,0,ACTIVE,`,
        `Row 2,${sku},${uniqueBarcode()},${categoryName},PIECE,1.00,2.00,0,0,0,ACTIVE,`
      ].join("\n")
    )
  );

  assert.ok(
    preview.rows
      .flatMap((row) => row.errors)
      .some((issue) => issue.code === "DUPLICATE_SKU_IN_FILE")
  );
});

test("import preview rejects duplicate barcode", { concurrency: false }, async () => {
  const barcode = uniqueBarcode();
  const categoryName = await resolveCategoryName();
  const preview = await previewProductImport(
    csvFile(
      "dup-barcode.csv",
      [
        "name,sku,barcode,category,unit,costPrice,sellingPrice,reorderLevel,targetStockLevel,initialStock,status,description",
        `Row 1,${uniqueSku("BAR1")},${barcode},${categoryName},PIECE,1.00,2.00,0,0,0,ACTIVE,`,
        `Row 2,${uniqueSku("BAR2")},${barcode},${categoryName},PIECE,1.00,2.00,0,0,0,ACTIVE,`
      ].join("\n")
    )
  );

  assert.ok(
    preview.rows
      .flatMap((row) => row.errors)
      .some((issue) => issue.code === "DUPLICATE_BARCODE_IN_FILE")
  );
});

test(
  "stock-in synchronization keeps inventory, batch total, and movement aligned",
  { concurrency: false },
  async () => {
    const product = await createProduct(buildProductInput({ initialStock: 0 }));
    const result = await addStock(product.id, {
      quantity: 6,
      reason: "Supplier restock"
    });
    const state = await getStockState(product.id);

    assert.equal(result.inventory.currentQuantity, 6);
    assert.equal(state.inventory.quantityOnHand, 6);
    assert.equal(state.batchTotal, 6);
    assert.equal(state.movements.at(-1)?.type, "STOCK_IN");
    assertInvariant(state);
  }
);

test(
  "positive adjustment creates traceable stock and preserves the invariant",
  { concurrency: false },
  async () => {
    const product = await createProduct(buildProductInput({ initialStock: 0 }));
    await addStock(product.id, { quantity: 4, reason: "Seed stock" });
    const result = await adjustStock(product.id, {
      movementType: "ADJUSTMENT_IN",
      quantity: 3,
      reason: "Cycle count correction"
    });
    const state = await getStockState(product.id);

    assert.equal(result.inventory.currentQuantity, 7);
    assert.equal(state.inventory.quantityOnHand, 7);
    assert.equal(state.batchTotal, 7);
    assert.equal(state.movements.at(-1)?.type, "ADJUSTMENT_IN");
    assertInvariant(state);
  }
);

test(
  "negative adjustment reduces stock without creating negative batches",
  { concurrency: false },
  async () => {
    const product = await createProduct(buildProductInput({ initialStock: 0 }));
    await addStock(product.id, { quantity: 6, reason: "Seed stock" });
    const result = await adjustStock(product.id, {
      movementType: "ADJUSTMENT_OUT",
      quantity: 2,
      reason: "Damage write-off"
    });
    const state = await getStockState(product.id);

    assert.equal(result.inventory.currentQuantity, 4);
    assert.equal(state.inventory.quantityOnHand, 4);
    assert.equal(state.batchTotal, 4);
    assert.equal(state.movements.at(-1)?.type, "ADJUSTMENT_OUT");
    assertInvariant(state);
  }
);

test(
  "insufficient stock rejection leaves inventory unchanged",
  { concurrency: false },
  async () => {
    const product = await createProduct(buildProductInput({ initialStock: 0 }));
    await addStock(product.id, { quantity: 1, reason: "Seed stock" });

    await assert.rejects(
      () =>
        adjustStock(product.id, {
          movementType: "ADJUSTMENT_OUT",
          quantity: 2,
          reason: "Too much removal"
        }),
      (error) =>
        error instanceof Error &&
        error.message.includes("Insufficient sellable stock for checkout.")
    );

    const state = await getStockState(product.id);
    assert.equal(state.inventory.quantityOnHand, 1);
    assert.equal(state.batchTotal, 1);
    assertInvariant(state);
  }
);

test("POS search availability reflects activation state", { concurrency: false }, async () => {
  const product = await createProduct(buildProductInput({ initialStock: 3 }));
  const found = await searchPosProducts(product.sku, { page: 1, pageSize: 20 });

  assert.equal(
    found.products.some((entry) => entry.id === product.id),
    true
  );
  assert.equal(found.products.find((entry) => entry.id === product.id)?.availableStock, 3);

  await changeProductStatus(product.id, { status: "INACTIVE" });

  const hidden = await searchPosProducts(product.sku, { page: 1, pageSize: 20 });
  assert.equal(
    hidden.products.some((entry) => entry.id === product.id),
    false
  );

  await changeProductStatus(product.id, { status: "ACTIVE" });

  const restored = await searchPosProducts(product.sku, { page: 1, pageSize: 20 });
  assert.equal(
    restored.products.some((entry) => entry.id === product.id),
    true
  );
});

test(
  "POS server-side pagination returns more than 20 total matches",
  { concurrency: false },
  async () => {
    const query = `POSPAG-${uniqueLabel("Q")}`;

    for (const index of Array.from({ length: 21 }, (_, itemIndex) => itemIndex)) {
      await createProduct(
        buildProductInput({
          initialStock: 1,
          name: `${query}-${index + 1}`,
          sku: uniqueSku(`POS${index + 1}`)
        })
      );
    }

    const pageOne = await searchPosProducts(query, { page: 1, pageSize: 20 });
    const pageTwo = await searchPosProducts(query, { page: 2, pageSize: 20 });

    assert.ok((pageOne.meta.totalItems ?? 0) >= 21);
    assert.equal(pageOne.products.length, 20);
    assert.equal(pageTwo.products.length, 1);
  }
);

test(
  "POS checkout deducts batch stock, inventory, and creates sale records",
  { concurrency: false },
  async () => {
    const product = await createProduct(buildProductInput({ initialStock: 5 }));
    const cashier = await createTestCashier();
    const result = await checkoutPosSale({
      cashierId: cashier.id,
      cashierName: cashier.name,
      items: [{ productId: product.id, quantity: 2 }]
    });

    assert.equal(result.sale.items.length, 1);

    const state = await getStockState(product.id);
    assert.equal(state.inventory.quantityOnHand, 3);
    assert.equal(state.batchTotal, 3);
    assert.equal(state.movements.at(-1)?.type, "SALE");
    assert.equal(await prisma.sale.count({ where: { saleNumber: result.sale.saleNumber } }), 1);
    assert.equal(await prisma.saleItem.count({ where: { saleId: result.sale.id } }), 1);
    assertInvariant(state);
  }
);

test("POS checkout rolls back when a later write fails", { concurrency: false }, async () => {
  const first = await createProduct(buildProductInput({ initialStock: 3 }));
  const second = await createProduct(buildProductInput({ initialStock: 1 }));
  const cashier = await createTestCashier();

  await withPatchedTransaction(
    (tx) => ({
      ...tx,
      saleItem: {
        ...tx.saleItem,
        create: (async () => {
          throw new Error("Synthetic sale item failure.");
        }) as unknown as typeof tx.saleItem.create
      }
    }),
    async () => {
      await assert.rejects(() =>
        checkoutPosSale({
          cashierId: cashier.id,
          cashierName: cashier.name,
          items: [
            { productId: first.id, quantity: 1 },
            { productId: second.id, quantity: 1 }
          ]
        })
      );
    }
  );

  const firstState = await getStockState(first.id);
  const secondState = await getStockState(second.id);

  assert.equal(firstState.inventory.quantityOnHand, 3);
  assert.equal(secondState.inventory.quantityOnHand, 1);
  assert.equal(firstState.batchTotal, 3);
  assert.equal(secondState.batchTotal, 1);
  assert.equal(firstState.movements.length, 1);
  assert.equal(secondState.movements.length, 1);
  assertInvariant(firstState);
  assertInvariant(secondState);
});

test("availability toggles preserve stock and POS visibility", { concurrency: false }, async () => {
  const product = await createProduct(buildProductInput({ initialStock: 4 }));
  const initialState = await getStockState(product.id);

  assert.equal(initialState.inventory.quantityOnHand, 4);
  assert.equal(initialState.batchTotal, 4);

  await changeProductStatus(product.id, { status: "INACTIVE" });

  const inactiveState = await getStockState(product.id);
  const inactiveLookup = await searchPosProducts(product.sku, { page: 1, pageSize: 20 });

  assert.equal(inactiveState.inventory.quantityOnHand, 4);
  assert.equal(inactiveState.batchTotal, 4);
  assert.equal(
    inactiveLookup.products.some((entry) => entry.id === product.id),
    false
  );

  await changeProductStatus(product.id, { status: "ACTIVE" });

  const activeState = await getStockState(product.id);
  const activeLookup = await searchPosProducts(product.sku, { page: 1, pageSize: 20 });

  assert.equal(activeState.inventory.quantityOnHand, 4);
  assert.equal(activeState.batchTotal, 4);
  assert.equal(
    activeLookup.products.some((entry) => entry.id === product.id),
    true
  );
});

test("discontinued products reject availability toggles", { concurrency: false }, async () => {
  const product = await createProduct(
    buildProductInput({ initialStock: 0, status: "DISCONTINUED" })
  );

  await assert.rejects(
    () => changeProductStatus(product.id, { status: "ACTIVE" }),
    (error) => error instanceof Error && error.message.includes("Discontinued products cannot use")
  );
});

test("requireRole allows OWNER and blocks STAFF", { concurrency: false }, async () => {
  const owner = await createTestUser("OWNER");
  const staff = await createTestUser("STAFF");

  await assert.equal(await runRoleCheck(owner, "OWNER"), undefined);

  const blocked = await runRoleCheck(staff, "OWNER");
  assert.ok(blocked instanceof Error);
  assert.ok(blocked.message.includes("permission"));
});

test("stock audit detects a mismatch without mutating data", { concurrency: false }, async () => {
  const product = await createProduct(buildProductInput({ initialStock: 4 }));
  await prisma.inventory.update({
    data: {
      quantityOnHand: 5
    },
    where: {
      productId: product.id
    }
  });

  const auditRows = await auditStock();
  const row = auditRows.find((entry) => entry.productId === product.id);

  assert.equal(row?.invariantStatus, "MISMATCH");
  assert.equal(row?.difference, 1);

  await prisma.inventory.update({
    data: {
      quantityOnHand: 4
    },
    where: {
      productId: product.id
    }
  });
});

type ProductInputOverrides = Partial<{
  initialStock: number;
  name: string;
  sku: string;
  status: "ACTIVE" | "INACTIVE" | "DISCONTINUED";
}>;

function buildProductInput(overrides: ProductInputOverrides = {}) {
  const suffix = randomUUID().slice(0, 8);

  return {
    barcode: uniqueBarcode(),
    categoryId,
    costPrice: "10.00",
    description: `Test item ${suffix}`,
    initialStock: overrides.initialStock ?? 0,
    name: overrides.name ?? `DATA FLOW TEST PRODUCT ${suffix}`,
    reorderLevel: 2,
    sellingPrice: "15.00",
    sku: overrides.sku ?? uniqueSku("TEST"),
    status: overrides.status ?? ("ACTIVE" as const),
    targetStockLevel: 5,
    unit: "PIECE" as const
  };
}

async function getStockState(productId: string) {
  const product = await prisma.product.findUnique({
    include: {
      inventory: true,
      inventoryBatches: true,
      inventoryMovements: true
    },
    where: {
      id: productId
    }
  });

  if (!product || !product.inventory) {
    throw new Error(`Missing product or inventory for ${productId}.`);
  }

  const batchTotal = product.inventoryBatches.reduce(
    (sum, batch) => sum + batch.quantityRemaining,
    0
  );

  return {
    batchTotal,
    inventory: product.inventory,
    movements: product.inventoryMovements,
    product
  };
}

function assertInvariant(state: Awaited<ReturnType<typeof getStockState>>) {
  assert.equal(state.inventory.quantityOnHand, state.batchTotal);
}

function csvFile(originalname: string, csv: string): UploadedFile {
  return {
    originalname,
    mimetype: "text/csv",
    buffer: Buffer.from(csv, "utf8")
  };
}

function uniqueSku(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 12).toUpperCase()}`;
}

function uniqueBarcode() {
  return `99${randomUUID().replace(/-/g, "").slice(0, 13)}`;
}

function uniqueLabel(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
}

async function resolveCategoryName() {
  const category = await prisma.category.findFirst({
    orderBy: {
      name: "asc"
    },
    select: {
      name: true
    }
  });

  if (category) {
    return category.name;
  }

  const created = await prisma.category.create({
    data: {
      name: `Test Category ${randomUUID().slice(0, 6)}`,
      slug: `test-category-${randomUUID().slice(0, 6)}`,
      description: "Temporary test category",
      isActive: true
    }
  });

  categoryId = created.id;
  return created.name;
}

async function ensureCategoryId() {
  const category = await prisma.category.findFirst({
    orderBy: {
      name: "asc"
    },
    select: {
      id: true
    }
  });

  if (category) {
    return category.id;
  }

  const created = await prisma.category.create({
    data: {
      name: `Test Category ${randomUUID().slice(0, 6)}`,
      slug: `test-category-${randomUUID().slice(0, 6)}`,
      description: "Temporary test category",
      isActive: true
    }
  });

  return created.id;
}

async function createTestCashier() {
  return createTestUser("STAFF", "Test Cashier");
}

async function createTestUser(role: "OWNER" | "STAFF", namePrefix = "Test User") {
  const suffix = randomUUID().slice(0, 8);

  return prisma.user.create({
    data: {
      email: `${role.toLowerCase()}-${suffix}@example.com`,
      name: `${namePrefix} ${suffix}`,
      passwordHash: "test-password-hash",
      role,
      status: "ACTIVE"
    }
  });
}

async function runRoleCheck(
  user: Awaited<ReturnType<typeof createTestUser>>,
  requiredRole: "OWNER"
) {
  return new Promise<Error | undefined>((resolve) => {
    const middleware = requireRole(requiredRole);

    middleware({ authUser: user } as never, {} as never, (error) => {
      resolve(error as Error | undefined);
    });
  });
}

async function withPatchedTransaction<T>(
  transformTx: (tx: Prisma.TransactionClient) => Prisma.TransactionClient,
  run: () => Promise<T>
) {
  const originalTransaction = prisma.$transaction.bind(prisma);
  const prismaWithTransaction = prisma as PrismaClient & {
    $transaction: typeof prisma.$transaction;
  };

  const patchedTransaction = (async (
    callback: Parameters<typeof prisma.$transaction>[0],
    options?: Parameters<typeof prisma.$transaction>[1]
  ) => {
    if (typeof callback === "function") {
      return originalTransaction(async (tx) => callback(transformTx(tx)), options);
    }

    return originalTransaction(callback, options);
  }) as typeof prisma.$transaction;

  prismaWithTransaction.$transaction = patchedTransaction;

  try {
    return await run();
  } finally {
    prismaWithTransaction.$transaction = originalTransaction;
  }
}
