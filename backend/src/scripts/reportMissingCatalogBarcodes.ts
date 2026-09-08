import { prisma } from "../database/prismaClient.js";

async function main() {
  const [totalProducts, productsWithBarcode, missingBarcodeProducts] = await Promise.all([
    prisma.product.count({
      where: {
        recordSource: { not: "TEST_FIXTURE" }
      }
    }),
    prisma.product.count({
      where: {
        barcode: { not: null },
        recordSource: { not: "TEST_FIXTURE" }
      }
    }),
    prisma.product.findMany({
      where: {
        barcode: null,
        recordSource: { not: "TEST_FIXTURE" }
      },
      orderBy: [{ category: { name: "asc" } }, { sku: "asc" }],
      select: {
        id: true,
        sku: true,
        name: true,
        brand: true,
        variant: true,
        sizeValue: true,
        sizeUnit: true,
        unit: true,
        status: true,
        recordSource: true,
        dataQualityStatus: true,
        costPrice: true,
        sellingPrice: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        inventory: {
          select: {
            id: true,
            quantityOnHand: true
          }
        },
        sarimaSourceMapping: {
          select: {
            sourceProductId: true,
            sourceProductName: true,
            sourceCategory: true,
            sourceDataset: true
          }
        }
      }
    })
  ]);

  const byCategory = new Map<string, number>();
  const rows = missingBarcodeProducts.map((product) => {
    byCategory.set(product.category.name, (byCategory.get(product.category.name) ?? 0) + 1);

    return {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      brand: product.brand,
      variant: product.variant,
      sizeValue: product.sizeValue?.toString() ?? null,
      sizeUnit: product.sizeUnit,
      unit: product.unit,
      category: product.category.name,
      categorySlug: product.category.slug,
      status: product.status,
      recordSource: product.recordSource,
      dataQualityStatus: product.dataQualityStatus,
      sellingPrice: product.sellingPrice.toString(),
      hasProcurementCost: product.costPrice !== null,
      inventoryLinked: product.inventory !== null,
      quantityOnHand: product.inventory?.quantityOnHand ?? null,
      sarimaSourceProductId: product.sarimaSourceMapping?.sourceProductId ?? null,
      sarimaSourceProductName: product.sarimaSourceMapping?.sourceProductName ?? null,
      sarimaSourceCategory: product.sarimaSourceMapping?.sourceCategory ?? null,
      sarimaSourceDataset: product.sarimaSourceMapping?.sourceDataset ?? null
    };
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    totalOperationalCatalogProducts: totalProducts,
    productsWithBarcode,
    productsMissingBarcode: rows.length,
    barcodeCoveragePercent:
      totalProducts > 0 ? Number(((productsWithBarcode / totalProducts) * 100).toFixed(2)) : 0,
    missingByCategory: [...byCategory.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category))
  };

  console.log(JSON.stringify({ summary, rows }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
