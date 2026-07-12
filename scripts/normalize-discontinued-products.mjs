import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const discontinuedProducts = await prisma.product.findMany({
    orderBy: {
      name: "asc"
    },
    select: {
      barcode: true,
      id: true,
      name: true,
      sku: true,
      status: true
    },
    where: {
      status: "DISCONTINUED"
    }
  });

  if (discontinuedProducts.length === 0) {
    console.log("No discontinued products found.");
    return;
  }

  const result = await prisma.product.updateMany({
    data: {
      status: "INACTIVE"
    },
    where: {
      status: "DISCONTINUED"
    }
  });

  console.log(
    JSON.stringify(
      {
        normalizedCount: result.count,
        normalizedProducts: discontinuedProducts
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
