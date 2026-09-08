import { prisma } from "../database/prismaClient.js";
import {
  executeSyntheticBarcodeRehabilitation,
  type SyntheticBarcodeRehabilitationClient
} from "../modules/catalog/catalog-synthetic-barcode-rehabilitation-execution.js";

const APPLY_FLAG = "--apply-batch-04-synthetic-barcode-rehabilitation";

// Exact-unit evidence checkpoint (2026-09-08):
// P074 Those Days Regular With Wings 8 pads, red pack -> EAN 4801288850082
//   - Source image confirms red 8-wing-pad retail pack.
//   - Puregold + Iloilo Supermart independently expose the same exact-unit barcode.
// P075 Those Days All Night With Wings 8 pads, purple pack -> EAN 4801288870080
//   - St. Lucia Grocers + Iloilo Supermart independently expose the same exact-unit barcode.
// P089 Fresca Tuna Hot & Spicy 175g -> UPC 748485900087
//   - St. Lucia Grocers + Puregold independently expose the same exact-unit barcode.
//
// Product CUIDs are resolved at apply time from the invariant
// SARIMA SKU + source mapping + expected synthetic barcode tuple. Zero or
// multiple exact matches abort before the shared guarded executor runs.
const targets = [
  {
    sku: "SARIMA-P074",
    sarimaSourceProductId: "P074",
    expectedCurrentBarcode: "YSB-SARIMA-P074",
    verifiedBarcode: "4801288850082"
  },
  {
    sku: "SARIMA-P075",
    sarimaSourceProductId: "P075",
    expectedCurrentBarcode: "YSB-SARIMA-P075",
    verifiedBarcode: "4801288870080"
  },
  {
    sku: "SARIMA-P089",
    sarimaSourceProductId: "P089",
    expectedCurrentBarcode: "YSB-SARIMA-P089",
    verifiedBarcode: "748485900087"
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
        `BATCH_04_SYNTHETIC_BARCODE_REHABILITATION_IDENTITY_RESOLUTION_MISMATCH: ${target.sku} expected exactly 1 current YSB/SARIMA row, found ${matches.length}`
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
      `BATCH_04_SYNTHETIC_BARCODE_REHABILITATION_EXPLICIT_APPLY_REQUIRED: rerun with ${APPLY_FLAG}`
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
