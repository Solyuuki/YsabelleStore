import { prisma } from "../database/prismaClient.js";
import {
  executeSyntheticBarcodeRehabilitation,
  type SyntheticBarcodeRehabilitationClient
} from "../modules/catalog/catalog-synthetic-barcode-rehabilitation-execution.js";

const APPLY_FLAG = "--apply-batch-01-synthetic-barcode-rehabilitation";

const authorization = {
  identities: [
    {
      id: "cmtk4sfqw00utib1givs20mwk",
      sku: "SARIMA-P299",
      sarimaSourceProductId: "P299",
      expectedCurrentBarcode: "YSB-SARIMA-P299",
      verifiedBarcode: "4800016635724"
    },
    {
      id: "cmtk4sg34010pib1grc379g43",
      sku: "SARIMA-P352",
      sarimaSourceProductId: "P352",
      expectedCurrentBarcode: "YSB-SARIMA-P352",
      verifiedBarcode: "4800010076073"
    },
    {
      id: "cmtk4sg5n011pib1gyrtmog78",
      sku: "SARIMA-P361",
      sarimaSourceProductId: "P361",
      expectedCurrentBarcode: "YSB-SARIMA-P361",
      verifiedBarcode: "4800016082641"
    }
  ]
} as const;

async function main() {
  if (!process.argv.includes(APPLY_FLAG)) {
    throw new Error(
      `BATCH_01_SYNTHETIC_BARCODE_REHABILITATION_EXPLICIT_APPLY_REQUIRED: rerun with ${APPLY_FLAG}`
    );
  }

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
