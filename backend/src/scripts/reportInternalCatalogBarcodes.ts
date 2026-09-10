import { prisma } from "../database/prismaClient.js";
import {
  isYsabelleInternalBarcode,
  YSABELLE_INTERNAL_BARCODE_SCHEME
} from "../utils/catalogBarcode.js";

async function main() {
  const products = await prisma.product.findMany({
    where: {
      recordSource: { not: "TEST_FIXTURE" }
    },
    orderBy: [{ category: { name: "asc" } }, { sku: "asc" }],
    select: {
      id: true,
      sku: true,
      barcode: true,
      name: true,
      brand: true,
      variant: true,
      sizeValue: true,
      sizeUnit: true,
      unit: true,
      status: true,
      recordSource: true,
      dataQualityStatus: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      },
      sarimaSourceMapping: {
        select: {
          sourceProductId: true,
          sourceProductName: true,
          sourceCategory: true,
          sourceDataset: true
        }
      },
      canonicalAuditLogs: {
        where: {
          action: "INTERNAL_BARCODE_ASSIGNED"
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 1,
        select: {
          createdAt: true,
          evidence: true
        }
      }
    }
  });

  const internalProducts = products.filter((product) => isYsabelleInternalBarcode(product.barcode));
  const externalProducts = products.filter(
    (product) => product.barcode !== null && !isYsabelleInternalBarcode(product.barcode)
  );
  const missingProducts = products.filter((product) => product.barcode === null);

  const byCategory = new Map<string, number>();
  for (const product of internalProducts) {
    byCategory.set(product.category.name, (byCategory.get(product.category.name) ?? 0) + 1);
  }

  const rows = internalProducts.map((product) => {
    const assignmentAudit = product.canonicalAuditLogs[0] ?? null;

    return {
      productId: product.id,
      sku: product.sku,
      barcode: product.barcode,
      barcodeSource: "INTERNAL",
      symbology: YSABELLE_INTERNAL_BARCODE_SCHEME,
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
      assignedAt: assignmentAudit?.createdAt ?? null,
      auditEvidence: assignmentAudit?.evidence ?? null,
      sarimaSourceProductId: product.sarimaSourceMapping?.sourceProductId ?? null,
      sarimaSourceProductName: product.sarimaSourceMapping?.sourceProductName ?? null,
      sarimaSourceCategory: product.sarimaSourceMapping?.sourceCategory ?? null,
      sarimaSourceDataset: product.sarimaSourceMapping?.sourceDataset ?? null
    };
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    totalOperationalCatalogProducts: products.length,
    ysabelleInternalBarcodes: internalProducts.length,
    externalBarcodes: externalProducts.length,
    missingBarcodes: missingProducts.length,
    scannableCoveragePercent:
      products.length > 0
        ? Number(
            (((internalProducts.length + externalProducts.length) / products.length) * 100).toFixed(
              2
            )
          )
        : 0,
    ysbByCategory: [...byCategory.entries()]
      .map(([category, count]) => ({ category, count }))
      .sort(
        (left, right) => right.count - left.count || left.category.localeCompare(right.category)
      )
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
