import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TARGETS = [
  {
    sku: "SARIMA-P218",
    barcode: "4800049720107",
    name: "Nature's Spring Purified Drinking Water 350mL"
  },
  { sku: "SARIMA-P217", barcode: "4801981107971", name: "Wilkins Pure Drinking Water 500mL" },
  { sku: "SARIMA-P237", barcode: "8997035563414", name: "Pocari Sweat 500mL" },
  { sku: "SARIMA-P261", barcode: "4801981116072", name: "Coca-Cola 1.5L" },
  { sku: "SARIMA-P014", barcode: "072810293606", name: "Ligo Sardines in Tomato Sauce Chili Added" }
];

const apply = process.argv.includes("--apply");
const targetSkus = TARGETS.map((item) => item.sku);

function fail(message) {
  throw new Error(`QA reset aborted: ${message}`);
}

function normalizeQaName(value) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

try {
  const products = await prisma.product.findMany({
    where: { sku: { in: targetSkus } },
    select: {
      id: true,
      sku: true,
      barcode: true,
      name: true,
      dataQualityStatus: true,
      inventory: { select: { quantityOnHand: true } },
      _count: {
        select: {
          saleItems: true,
          customerOrderItems: true,
          historicalMonthlySales: true,
          historicalSalesImportRows: true
        }
      }
    },
    orderBy: { sku: "asc" }
  });

  console.table(
    products.map((product) => ({
      sku: product.sku,
      barcode: product.barcode,
      name: product.name,
      quality: product.dataQualityStatus,
      stock: product.inventory?.quantityOnHand ?? 0,
      saleItems: product._count.saleItems,
      orderItems: product._count.customerOrderItems,
      historicalRows:
        product._count.historicalMonthlySales + product._count.historicalSalesImportRows
    }))
  );

  if (products.length !== TARGETS.length) {
    fail(`expected exactly ${TARGETS.length} target products, found ${products.length}.`);
  }

  const bySku = new Map(products.map((product) => [product.sku, product]));
  for (const target of TARGETS) {
    const product = bySku.get(target.sku);
    if (!product) fail(`missing ${target.sku}.`);
    if (product.barcode !== target.barcode) {
      fail(
        `${target.sku} barcode mismatch. Expected ${target.barcode}, found ${product.barcode ?? "NULL"}.`
      );
    }
    if (normalizeQaName(product.name) !== normalizeQaName(target.name)) {
      fail(`${target.sku} name mismatch. Expected "${target.name}", found "${product.name}".`);
    }
    if (product._count.saleItems > 0 || product._count.customerOrderItems > 0) {
      fail(`${target.sku} has sales/order history and will not be deleted.`);
    }
    if (product._count.historicalMonthlySales > 0 || product._count.historicalSalesImportRows > 0) {
      fail(`${target.sku} has historical-sales data and will not be deleted.`);
    }
    if ((product.inventory?.quantityOnHand ?? 0) !== 0) {
      fail(`${target.sku} has non-zero stock and will not be deleted.`);
    }
  }

  if (!apply) {
    console.log("\nDry run only. All five targets passed safety checks.");
    console.log("Run again with --apply to remove them for the 5-product package QA test.");
    process.exitCode = 0;
  } else {
    const productIds = products.map((product) => product.id);

    await prisma.$transaction(async (tx) => {
      await tx.productDuplicateCandidate.deleteMany({
        where: {
          OR: [{ leftProductId: { in: productIds } }, { rightProductId: { in: productIds } }]
        }
      });
      await tx.productCanonicalMapping.deleteMany({
        where: {
          OR: [{ sourceProductId: { in: productIds } }, { canonicalProductId: { in: productIds } }]
        }
      });
      await tx.sarimaSourceProductMapping.deleteMany({
        where: { canonicalProductId: { in: productIds } }
      });
      await tx.productAlias.deleteMany({ where: { canonicalProductId: { in: productIds } } });
      await tx.recommendationRecord.deleteMany({ where: { productId: { in: productIds } } });
      await tx.forecastRecord.deleteMany({ where: { productId: { in: productIds } } });
      await tx.inventoryMovement.deleteMany({ where: { productId: { in: productIds } } });
      await tx.inventoryBatch.deleteMany({ where: { productId: { in: productIds } } });
      await tx.inventory.deleteMany({ where: { productId: { in: productIds } } });
      await tx.product.deleteMany({ where: { id: { in: productIds } } });
    });

    const remaining = await prisma.product.count({ where: { sku: { in: targetSkus } } });
    if (remaining !== 0) fail(`${remaining} target product(s) still remain after reset.`);

    console.log(
      "\nQA reset complete: removed exactly 5 target products and non-transactional dependent records."
    );
    console.log("You can now test the five-product Local or Google Drive package as new products.");
  }
} finally {
  await prisma.$disconnect();
}
