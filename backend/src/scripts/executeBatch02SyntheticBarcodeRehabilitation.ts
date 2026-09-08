import { prisma } from "../database/prismaClient.js";
import {
  executeSyntheticBarcodeRehabilitation,
  type SyntheticBarcodeRehabilitationClient
} from "../modules/catalog/catalog-synthetic-barcode-rehabilitation-execution.js";

const APPLY_FLAG = "--apply-batch-02-synthetic-barcode-rehabilitation";

const authorization = {
  identities: [
    {
      id: "cmtk4sci10029ib1ggerp7k5p",
      sku: "SARIMA-P023",
      sarimaSourceProductId: "P023",
      expectedCurrentBarcode: "YSB-SARIMA-P023",
      verifiedBarcode: "4806502721445"
    },
    {
      id: "cmtk4scia002dib1ghawtsxbd",
      sku: "SARIMA-P024",
      sarimaSourceProductId: "P024",
      expectedCurrentBarcode: "YSB-SARIMA-P024",
      verifiedBarcode: "4806502721452"
    },
    {
      id: "cmtk4scj2002pib1gq2hussan",
      sku: "SARIMA-P027",
      sarimaSourceProductId: "P027",
      expectedCurrentBarcode: "YSB-SARIMA-P027",
      verifiedBarcode: "4800148535992"
    }
  ]
} as const;

async function main() {
  if (!process.argv.includes(APPLY_FLAG)) {
    throw new Error(
      `BATCH_02_SYNTHETIC_BARCODE_REHABILITATION_EXPLICIT_APPLY_REQUIRED: rerun with ${APPLY_FLAG}`
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
