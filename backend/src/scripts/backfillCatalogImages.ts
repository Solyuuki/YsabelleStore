import path from "node:path";

import { prisma } from "../database/prismaClient.js";
import { runLegacyProductImageBackfill } from "../modules/catalog-image/legacyImageBackfill.js";

type BackfillCliOptions = {
  apply: boolean;
  productId?: string;
};

const repositoryRoot = path.resolve(import.meta.dirname, "..", "..", "..");

function parseArguments(args: string[]): BackfillCliOptions {
  const options: BackfillCliOptions = { apply: false };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument) continue;

    if (argument === "--apply") {
      options.apply = true;
      continue;
    }

    if (argument === "--product") {
      const value = args[index + 1]?.trim();
      if (!value || value.startsWith("--")) {
        throw new Error("--product requires a non-empty product id.");
      }
      options.productId = value;
      index += 1;
      continue;
    }

    if (argument.startsWith("--product=")) {
      const value = argument.slice("--product=".length).trim();
      if (!value) {
        throw new Error("--product requires a non-empty product id.");
      }
      options.productId = value;
      continue;
    }

    throw new Error(`Unknown catalog image backfill argument: ${argument}`);
  }

  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const result = await runLegacyProductImageBackfill({
    apply: options.apply,
    productId: options.productId,
    repositoryRoot
  });

  console.log(`CIQE legacy image backfill ${options.apply ? "APPLY" : "DRY RUN"}`);
  if (!options.apply) {
    console.log("DRY RUN: no database or catalog-image storage mutation was requested.");
  }

  for (const item of result.plan) {
    const source = item.sourcePath ? ` source=${item.sourcePath}` : "";
    console.log(
      `[${item.status}] ${item.productId} | ${item.productName} | ${item.reason}${source}`
    );
  }

  console.log("Summary:");
  console.log(`  eligible=${result.eligible}`);
  console.log(`  processed=${result.processed}`);
  console.log(`  approvedQuality=${result.approvedQuality}`);
  console.log(`  needsReview=${result.needsReview}`);
  console.log(`  rejected=${result.rejected}`);
  console.log(`  failed=${result.failed}`);
  console.log(`  skipped=${result.skipped}`);
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Catalog image backfill failed unexpectedly."
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
