import { prisma } from "../database/prismaClient.js";
import {
  executeSyntheticBarcodeRehabilitation,
  type SyntheticBarcodeRehabilitationClient
} from "../modules/catalog/catalog-synthetic-barcode-rehabilitation-execution.js";

const APPLY_FLAG = "--apply-batch-05-synthetic-barcode-rehabilitation";

// Exact-unit evidence checkpoint (2026-09-08):
// P103 Lady's Choice Chicken Spread 27mL -> EAN 4800888607119
// P122 Hokkaido Mackerel in Oil 425g -> EAN 4800158987019
// P141 Magnolia Cheezee 160g -> EAN 4805358317031
// P317 Nature's Spring Distilled Drinking Water 10L -> EAN 4800049720244
// P318 Wilkins Distilled Drinking Water 7L -> EAN 4801981164714
// P397 Alaska Fortified Powdered Milk Drink 300g -> EAN 4800575144590
//
// Ambiguous/conflicting/no-evidence products from the same research chunk are
// intentionally isolated in the paired evidence checkpoint and are not included
// here. Product CUIDs are resolved at apply time from the invariant SARIMA tuple.
const targets = [
  {
    sku: "SARIMA-P103",
    sarimaSourceProductId: "P103",
    expectedCurrentBarcode: "YSB-SARIMA-P103",
    verifiedBarcode: "4800888607119"
  },
  {
    sku: "SARIMA-P122",
    sarimaSourceProductId: "P122",
    expectedCurrentBarcode: "YSB-SARIMA-P122",
    verifiedBarcode: "4800158987019"
  },
  {
    sku: "SARIMA-P141",
    sarimaSourceProductId: "P141",
    expectedCurrentBarcode: "YSB-SARIMA-P141",
    verifiedBarcode: "4805358317031"
  },
  {
    sku: "SARIMA-P317",
    sarimaSourceProductId: "P317",
    expectedCurrentBarcode: "YSB-SARIMA-P317",
    verifiedBarcode: "4800049720244"
  },
  {
    sku: "SARIMA-P318",
    sarimaSourceProductId: "P318",
    expectedCurrentBarcode: "YSB-SARIMA-P318",
    verifiedBarcode: "4801981164714"
  },
  {
    sku: "SARIMA-P397",
    sarimaSourceProductId: "P397",
    expectedCurrentBarcode: "YSB-SARIMA-P397",
    verifiedBarcode: "4800575144590"
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
    const match = matches[0];

    if (matches.length !== 1 || !match) {
      throw new Error(
        `BATCH_05_SYNTHETIC_BARCODE_REHABILITATION_IDENTITY_RESOLUTION_MISMATCH: ${target.sku} expected exactly 1 current YSB/SARIMA row, found ${matches.length}`
      );
    }

    return {
      id: match.id,
      ...target
    };
  });

  return { identities } as const;
}

async function main() {
  if (!process.argv.includes(APPLY_FLAG)) {
    throw new Error(
      `BATCH_05_SYNTHETIC_BARCODE_REHABILITATION_EXPLICIT_APPLY_REQUIRED: rerun with ${APPLY_FLAG}`
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
