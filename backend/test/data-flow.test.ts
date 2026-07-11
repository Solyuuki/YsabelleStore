import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";

import type { Prisma, PrismaClient } from "@prisma/client";

import { prisma } from "../src/database/prismaClient.js";
import { requireRole } from "../src/middleware/roleMiddleware.js";
import { addStock, adjustStock } from "../src/services/inventoryService.js";
import { checkoutPosSale, listRecentSales, searchPosProducts } from "../src/services/posService.js";
import {
  changeProductStatus,
  createCategory,
  createProduct
} from "../src/services/productService.js";
import {
  getProductImportTemplateCsv,
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
  "create product starts with empty inventory and no opening batches",
  { concurrency: false },
  async () => {
    const product = await createProduct(buildProductInput());
    const state = await getStockState(product.id);

    assert.equal(state.inventory.quantityOnHand, 0);
    assert.equal(state.batchTotal, 0);
    assert.equal(state.movements.length, 0);
    assertInvariant(state);
  }
);

test("create product does not require opening stock batches", { concurrency: false }, async () => {
  const sku = uniqueSku("ROLLBACK");

  const product = await withPatchedTransaction(
    (tx) => ({
      ...tx,
      inventoryBatch: {
        ...tx.inventoryBatch,
        create: (async () => {
          throw new Error("Synthetic opening batch failure.");
        }) as unknown as typeof tx.inventoryBatch.create
      }
    }),
    async () => createProduct(buildProductInput({ sku }))
  );

  const state = await getStockState(product.id);

  assert.equal(state.inventory.quantityOnHand, 0);
  assert.equal(state.batchTotal, 0);
  assert.equal(state.movements.length, 0);
  assertInvariant(state);
});

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

test(
  "create category returns a created category and preserves stock data",
  { concurrency: false },
  async () => {
    const beforeCounts = {
      category: await prisma.category.count(),
      inventory: await prisma.inventory.count(),
      product: await prisma.product.count()
    };

    const name = `Manual Category ${randomUUID().slice(0, 8)}`;
    const created = await createCategory({
      description: "Manual category created by test",
      name
    });

    assert.equal(created.name, name);
    assert.ok(created.slug.startsWith("manual-category"));
    assert.equal(await prisma.category.count(), beforeCounts.category + 1);
    assert.equal(await prisma.product.count(), beforeCounts.product);
    assert.equal(await prisma.inventory.count(), beforeCounts.inventory);
  }
);

test("create category rejects duplicates", { concurrency: false }, async () => {
  const name = `Duplicate Category ${randomUUID().slice(0, 8)}`;
  await createCategory({ name });

  await assert.rejects(
    () => createCategory({ name }),
    (error) =>
      error instanceof Error &&
      error.message.includes("Category already exists.") &&
      (error as { code?: string }).code === "CATEGORY_ALREADY_EXISTS"
  );
});

test("create category rejects duplicate slug", { concurrency: false }, async () => {
  const slug = `duplicate-slug-${randomUUID().slice(0, 6)}`;
  await createCategory({ name: `Slug Category ${randomUUID().slice(0, 8)}`, slug });

  await assert.rejects(
    () => createCategory({ name: `Slug Category ${randomUUID().slice(0, 8)}`, slug }),
    (error) =>
      error instanceof Error &&
      error.message.includes("Category already exists.") &&
      (error as { code?: string }).code === "CATEGORY_ALREADY_EXISTS"
  );
});

test("create category rejects empty name", { concurrency: false }, async () => {
  await assert.rejects(
    () => createCategory({ name: "   " }),
    (error) =>
      error instanceof Error &&
      error.message.includes("Category name is required.") &&
      (error as { code?: string }).code === "INVALID_CATEGORY_REQUEST"
  );
});

test(
  "product import template is header-only and matches the canonical headers",
  { concurrency: false },
  async () => {
    const template = getProductImportTemplateCsv();
    const expectedHeaders =
      "name,sku,barcode,category,unit,costPrice,sellingPrice,reorderLevel,targetStockLevel,initialStock,status,description";

    assert.equal(template, expectedHeaders);
    assert.equal(template.split("\n").length, 1);
    assert.equal(template.includes("BEV-COLA-101"), false);
    assert.equal(template.includes("4800099991001"), false);
  }
);

test("product import template preview reports zero data rows", { concurrency: false }, async () => {
  const preview = await previewProductImport(
    csvFile("product-import-template.csv", getProductImportTemplateCsv())
  );

  assert.equal(preview.totalRows, 0);
  assert.equal(preview.validRows, 0);
  assert.equal(preview.invalidRows, 0);
  assert.ok(preview.errors.some((issue) => issue.code === "NO_DATA_ROWS"));
});

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

test("blank optional barcode passes import preview", { concurrency: false }, async () => {
  const categoryName = await resolveCategoryName();
  const sku = uniqueSku("BLANKBAR");
  const preview = await previewProductImport(
    csvFile(
      "blank-barcode.csv",
      [
        "name,sku,barcode,category,unit,costPrice,sellingPrice,reorderLevel,targetStockLevel,initialStock,status,description",
        `Blank Barcode Product,${sku},,${categoryName},PIECE,1.00,2.00,0,0,0,ACTIVE,`
      ].join("\n")
    )
  );

  assert.equal(preview.invalidRows, 0);
  assert.equal(preview.validRows, 1);
  assert.equal(preview.rows[0]?.normalizedData?.barcode, null);
});

test("import preview rejects invalid category", { concurrency: false }, async () => {
  const preview = await previewProductImport(
    csvFile(
      "invalid-category.csv",
      [
        "name,sku,barcode,category,unit,costPrice,sellingPrice,reorderLevel,targetStockLevel,initialStock,status,description",
        `Unknown Category Product,${uniqueSku("CAT")},${uniqueBarcode()},Unknown Category,PIECE,1.00,2.00,0,0,0,ACTIVE,`
      ].join("\n")
    )
  );

  assert.ok(
    preview.rows.flatMap((row) => row.errors).some((issue) => issue.code === "UNKNOWN_CATEGORY")
  );
});

test("import preview rejects invalid unit", { concurrency: false }, async () => {
  const categoryName = await resolveCategoryName();
  const preview = await previewProductImport(
    csvFile(
      "invalid-unit.csv",
      [
        "name,sku,barcode,category,unit,costPrice,sellingPrice,reorderLevel,targetStockLevel,initialStock,status,description",
        `Invalid Unit Product,${uniqueSku("UNIT")},${uniqueBarcode()},${categoryName},CAN,1.00,2.00,0,0,0,ACTIVE,`
      ].join("\n")
    )
  );

  assert.ok(
    preview.rows.flatMap((row) => row.errors).some((issue) => issue.code === "INVALID_UNIT")
  );
});

test("import preview rejects invalid status", { concurrency: false }, async () => {
  const categoryName = await resolveCategoryName();
  const preview = await previewProductImport(
    csvFile(
      "invalid-status.csv",
      [
        "name,sku,barcode,category,unit,costPrice,sellingPrice,reorderLevel,targetStockLevel,initialStock,status,description",
        `Invalid Status Product,${uniqueSku("STATUS")},${uniqueBarcode()},${categoryName},PIECE,1.00,2.00,0,0,0,PENDING,`
      ].join("\n")
    )
  );

  assert.ok(
    preview.rows.flatMap((row) => row.errors).some((issue) => issue.code === "INVALID_STATUS")
  );
});

test(
  "stock-in synchronization keeps inventory, batch total, and movement aligned",
  { concurrency: false },
  async () => {
    const product = await createProduct(buildProductInput());
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
    const product = await createProduct(buildProductInput());
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
    const product = await createProduct(buildProductInput());
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
    const product = await createProduct(buildProductInput());
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
  const product = await createProduct(buildProductInput());
  await addStock(product.id, { quantity: 3, reason: "Seed stock" });
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
      const product = await createProduct(
        buildProductInput({
          name: `${query}-${index + 1}`,
          sku: uniqueSku(`POS${index + 1}`)
        })
      );

      await addStock(product.id, { quantity: 1, reason: "Seed stock" });
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
    const product = await createProduct(buildProductInput());
    await addStock(product.id, { quantity: 5, reason: "Seed stock" });
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

test(
  "POS checkout response exposes receipt fields for printing",
  { concurrency: false },
  async () => {
    const product = await createProduct(buildProductInput());
    await addStock(product.id, { quantity: 2, reason: "Receipt test stock" });
    const cashier = await createTestCashier();
    const result = await checkoutPosSale({
      cashierId: cashier.id,
      cashierName: cashier.name,
      items: [{ productId: product.id, quantity: 2 }]
    });

    assert.equal(result.sale.paymentMethod, "CASH");
    assert.equal(result.sale.cashReceived, result.sale.totalAmount);
    assert.equal(result.sale.change, "0");
    assert.equal(result.sale.itemCount, 2);
    assert.equal(result.sale.items[0]?.productName, product.name);
  }
);

test("Sales list preserves receipt fields for reprint", { concurrency: false }, async () => {
  const product = await createProduct(buildProductInput());
  await addStock(product.id, { quantity: 1, reason: "Receipt history stock" });
  const cashier = await createTestCashier();
  const sale = await checkoutPosSale({
    cashierId: cashier.id,
    cashierName: cashier.name,
    items: [{ productId: product.id, quantity: 1 }]
  });

  const recentSales = await listRecentSales(1);

  assert.equal(recentSales.sales[0]?.saleNumber, sale.sale.saleNumber);
  assert.equal(recentSales.sales[0]?.paymentMethod, "CASH");
  assert.equal(recentSales.sales[0]?.cashReceived, recentSales.sales[0]?.totalAmount);
  assert.equal(recentSales.sales[0]?.change, "0");
});

test("POS checkout rolls back when a later write fails", { concurrency: false }, async () => {
  const first = await createProduct(buildProductInput());
  await addStock(first.id, { quantity: 3, reason: "Seed stock" });
  const second = await createProduct(buildProductInput());
  await addStock(second.id, { quantity: 1, reason: "Seed stock" });
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
  const product = await createProduct(buildProductInput());
  await addStock(product.id, { quantity: 4, reason: "Seed stock" });
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
  const product = await createProduct(buildProductInput({ status: "DISCONTINUED" }));

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
  const product = await createProduct(buildProductInput());
  await addStock(product.id, { quantity: 4, reason: "Seed stock" });
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
