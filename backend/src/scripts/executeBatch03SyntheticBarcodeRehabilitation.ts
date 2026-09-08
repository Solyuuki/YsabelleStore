import { prisma } from "../database/prismaClient.js";
import {
  executeSyntheticBarcodeRehabilitation,
  type SyntheticBarcodeRehabilitationClient
} from "../modules/catalog/catalog-synthetic-barcode-rehabilitation-execution.js";

const APPLY_FLAG = "--apply-batch-03-synthetic-barcode-rehabilitation";

// Exact-unit evidence checkpoint (2026-09-08):
// P201 Barrio Fiesta Sauteed Shrimp Paste Spicy 250g -> UPC 737552870453
// P202 Barrio Fiesta Sauteed Shrimp Paste Regular 250g -> UPC 737552870439
// P204 Alaska Classic Sweetened Condensed Filled Milk 377g -> EAN 4800575120303
// P219 Nature's Spring Purified Drinking Water 500mL -> EAN 4800049720114
// P238 Pocari Sweat Ion Supply Drink 900mL -> EAN 4800350108878
// P254 Green Cross Isopropyl Alcohol 70% Solution 250mL -> EAN 4800047820021
//
// Product CUIDs are intentionally resolved at apply time from the invariant
// SARIMA SKU + source mapping + expected synthetic barcode tuple. The resolver
// refuses zero or multiple exact matches before the shared guarded executor runs.
const targets = [
  {
    sku: "SARIMA-P201",
    sarimaSourceProductId: "P201",
    expectedCurrentBarcode: "YSB-SARIMA-P201",
    verifiedBarcode: "737552870453"
  },
  {
    sku: "SARIMA-P202",
    sarimaSourceProductId: "P202",
    expectedCurrentBarcode: "YSB-SARIMA-P202",
    verifiedBarcode: "737552870439"
  },
  {
    sku: "SARIMA-P204",
    sarimaSourceProductId: "P204",
    expectedCurrentBarcode: "YSB-SARIMA-P204",
    verifiedBarcode: "4800575120303"
  },
  {
    sku: "SARIMA-P219",
    sarimaSourceProductId: "P219",
    expectedCurrentBarcode: "YSB-SARIMA-P219",
    verifiedBarcode: "4800049720114"
  },
  {
    sku: "SARIMA-P238",
    sarimaSourceProductId: "P238",
    expectedCurrentBarcode: "YSB-SARIMA-P238",
    verifiedBarcode: "4800350108878"
  },
  {
    sku: "SARIMA-P254",
    sarimaSourceProductId: "P254",
    expectedCurrentBarcode: "YSB-SARIMA-P254",
    verifiedBarcode: "4800047820021"
  }
] as const;

async function resolveAuthorization() {
  const rows = await prisma.product.findMany({
    where: { sku: { in: targets.map((target) => target.sku) } },
    select: {
      id: true,
      sku: true,
      barcode: true,
      sarimaSourceMapping: { select: { sourceProductId: true } }
    },
    orderBy: { id: "asc" }
  });

  const identities = targets.map((target) => {
    const matches = rows.filter(
      (row) =>
        row.sku === target.sku &&
        row.barcode === target.expectedCurrentBarcode &&
        row.sarimaSourceMapping?.sourceProductId === target.sarimaSourceProductId
    );

    if (matches.length !== 1) {
      throw new Error(
        `BATCH_03_SYNTHETIC_BARCODE_REHABILITATION_IDENTITY_RESOLUTION_MISMATCH: ${target.sku} expected exactly 1 current YSB/SARIMA row, found ${matches.length}`
      );
    }

    return {
      id: matches[0].id,
      ...target
    };
  });

  return { identities } as const;
}

async function main() {
  if (!process.argv.includes(APPLY_FLAG)) {
    throw new Error(
      `BATCH_03_SYNTHETIC_BARCODE_REHABILITATION_EXPLICIT_APPLY_REQUIRED: rerun with ${APPLY_FLAG}`
    );
  }

  const authorization = await resolveAuthorization();
  const result = await executeSyntheticBarcodeRehabilitation({
    client: prisma as unknown as SyntheticBarcodeRehabilitationClient,
    authorization
  });

  console.log(JSON.stringify(result.summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
