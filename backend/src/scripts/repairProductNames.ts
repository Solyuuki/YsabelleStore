import { prisma } from "../database/prismaClient.js";
import { hasLikelyMojibake, normalizeProductName } from "../utils/productNameNormalizer.js";

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      sku: true
    }
  });
  let scanned = 0;
  let repaired = 0;

  for (const product of products) {
    scanned += 1;
    const normalizedName = normalizeProductName(product.name);

    if (normalizedName === product.name) {
      continue;
    }

    await prisma.product.update({
      data: {
        name: normalizedName
      },
      where: {
        id: product.id
      }
    });
    repaired += 1;

    const reason = hasLikelyMojibake(product.name) ? "mojibake" : "whitespace/unicode";
    console.info(
      `Repaired ${reason} in product ${product.sku}: ${product.name} -> ${normalizedName}`
    );
  }

  console.info(
    JSON.stringify(
      {
        repairedProducts: repaired,
        scannedProducts: scanned
      },
      null,
      2
    )
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
