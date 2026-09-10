import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const shouldApply = process.argv.includes("--apply");
const fixturePattern = /^Customer Order Test ([0-9a-f]{8})$/i;

try {
  const categories = await prisma.category.findMany({
    include: {
      products: {
        orderBy: { id: "asc" },
        select: {
          dataQualityStatus: true,
          id: true,
          isStorefrontVisible: true,
          name: true,
          recordSource: true,
          sku: true
        }
      }
    },
    orderBy: { name: "asc" },
    where: { name: { startsWith: "Customer Order Test " } }
  });

  const fixtures = [];
  const skipped = [];

  for (const category of categories) {
    const match = category.name.match(fixturePattern);
    if (!match) {
      skipped.push(`${category.name} (name is not an exact generated fixture signature)`);
      continue;
    }

    const suffix = match[1].toLowerCase();
    const expectedProductName = `Customer Order Product ${suffix}`;
    const expectedSku = `CUSTOMER-ORDER-${suffix}`;

    if (
      category.products.length !== 1 ||
      category.products[0].name.toLowerCase() !== expectedProductName.toLowerCase() ||
      category.products[0].sku.toLowerCase() !== expectedSku.toLowerCase()
    ) {
      skipped.push(`${category.name} (product signature does not match)`);
      continue;
    }

    fixtures.push({
      categoryId: category.id,
      categoryName: category.name,
      productId: category.products[0].id,
      productName: category.products[0].name,
      suffix
    });
  }

  console.info(`${shouldApply ? "Apply" : "Dry-run"} customer-order fixture quarantine`);

  for (const fixture of fixtures) {
    console.info(
      `${shouldApply ? "QUARANTINE" : "WOULD QUARANTINE"} ${fixture.categoryName} / ${fixture.productName}`
    );
  }

  for (const reason of skipped) {
    console.warn(`SKIP ${reason}`);
  }

  if (!shouldApply) {
    console.info(
      "No database changes made. Re-run with --apply to hide only the exact fixtures above."
    );
  } else if (fixtures.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const fixture of fixtures) {
        await tx.product.update({
          data: {
            dataQualityStatus: "REJECTED",
            isStorefrontVisible: false,
            recordSource: "TEST_FIXTURE"
          },
          where: { id: fixture.productId }
        });
        await tx.category.update({
          data: {
            dataQualityStatus: "REJECTED",
            isActive: false,
            isStorefrontVisible: false,
            recordSource: "TEST_FIXTURE"
          },
          where: { id: fixture.categoryId }
        });
      }
    });
  }

  console.info(`Quarantined fixtures: ${shouldApply ? fixtures.length : 0}`);
} finally {
  await prisma.$disconnect();
}
