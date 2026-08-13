import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import { storefrontProductWhere } from "../backend/src/services/catalogQualityPolicy.js";

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      category: { select: { name: true } },
      id: true,
      imageUrl: true,
      name: true,
      sku: true
    },
    where: storefrontProductWhere()
  });

  assert(products.length > 0, "The temporary storefront must contain an image-ready product.");

  for (const product of products) {
    assert(product.imageUrl, `${product.id} passed the image-ready gate without an image URL.`);
    const assetPath = path.join(process.cwd(), "frontend", "public", product.imageUrl);
    const asset = await readFile(assetPath);
    assert.equal(asset.subarray(0, 4).toString("ascii"), "RIFF", `${assetPath} is not WebP.`);
    assert.equal(asset.subarray(8, 12).toString("ascii"), "WEBP", `${assetPath} is not WebP.`);
  }

  const categories = new Map<string, number>();
  products.forEach((product) => {
    categories.set(product.category.name, (categories.get(product.category.name) ?? 0) + 1);
  });

  console.info(
    JSON.stringify(
      {
        categories: Object.fromEntries(
          [...categories].sort(([left], [right]) => left.localeCompare(right))
        ),
        imageReadyProductCount: products.length,
        products: products.map(({ category, ...product }) => ({
          ...product,
          category: category.name
        }))
      },
      null,
      2
    )
  );
}

void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
