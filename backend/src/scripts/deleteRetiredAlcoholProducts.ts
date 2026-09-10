import { prisma } from "../database/prismaClient.js";

const APPLY_FLAG = "--apply-retired-alcohol-deletion";
const RETIRED_SKUS = ["SARIMA-P254", "SARIMA-P255"] as const;
const EXPECTED_PRODUCTS = [
  { sku: "SARIMA-P254", name: "Emperador Light 750ml" },
  { sku: "SARIMA-P255", name: "Alfons Light Brandy" }
] as const;

async function main() {
  const apply = process.argv.includes(APPLY_FLAG);
  const products = await prisma.product.findMany({
    where: { sku: { in: [...RETIRED_SKUS] } },
    select: {
      id: true,
      sku: true,
      name: true,
      status: true,
      dataQualityStatus: true,
      isStorefrontVisible: true
    },
    orderBy: { sku: "asc" }
  });

  if (products.length === 0) {
    console.log(
      JSON.stringify(
        { mode: apply ? "APPLY" : "PREVIEW", deleted: 0, alreadyAbsent: true },
        null,
        2
      )
    );
    return;
  }

  if (products.length !== EXPECTED_PRODUCTS.length) {
    throw new Error(
      `Expected exactly ${EXPECTED_PRODUCTS.length} retired alcohol products, found ${products.length}.`
    );
  }

  for (const expected of EXPECTED_PRODUCTS) {
    const product = products.find((item) => item.sku === expected.sku);
    if (!product || product.name !== expected.name) {
      throw new Error(`Identity guard failed for ${expected.sku}. Refusing deletion.`);
    }
    if (
      product.dataQualityStatus !== "REJECTED" ||
      product.status !== "DISCONTINUED" ||
      product.isStorefrontVisible
    ) {
      throw new Error(
        `${expected.sku} is not in the required REJECTED + DISCONTINUED + hidden retirement state.`
      );
    }
  }

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          mode: "PREVIEW",
          products,
          applyCommand: `npx tsx backend/src/scripts/deleteRetiredAlcoholProducts.ts ${APPLY_FLAG}`
        },
        null,
        2
      )
    );
    return;
  }

  const result = await prisma.product.deleteMany({
    where: {
      sku: { in: [...RETIRED_SKUS] },
      dataQualityStatus: "REJECTED",
      status: "DISCONTINUED",
      isStorefrontVisible: false
    }
  });

  if (result.count !== EXPECTED_PRODUCTS.length) {
    throw new Error(
      `Deletion count guard failed: expected ${EXPECTED_PRODUCTS.length}, deleted ${result.count}.`
    );
  }

  console.log(
    JSON.stringify({ mode: "APPLIED", deleted: result.count, skus: RETIRED_SKUS }, null, 2)
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
