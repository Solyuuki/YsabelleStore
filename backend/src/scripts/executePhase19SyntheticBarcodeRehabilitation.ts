import { prisma } from "../database/prismaClient.js";
import {
  executeSyntheticBarcodeRehabilitation,
  type SyntheticBarcodeRehabilitationClient
} from "../modules/catalog/catalog-synthetic-barcode-rehabilitation-execution.js";

const APPLY_FLAG = "--apply-phase-19-synthetic-barcode-rehabilitation";

const authorization = {
  identities: [
    {
      id: "cmtk4sg0600z9ib1gt25xxhl2",
      sku: "SARIMA-P339",
      sarimaSourceProductId: "P339",
      expectedCurrentBarcode: "YSB-SARIMA-P339",
      verifiedBarcode: "4800092332852"
    },
    {
      id: "cmtk4sg0e00zdib1gwzoa19p1",
      sku: "SARIMA-P340",
      sarimaSourceProductId: "P340",
      expectedCurrentBarcode: "YSB-SARIMA-P340",
      verifiedBarcode: "4800092331909"
    },
    {
      id: "cmtk4sg0r00zhib1gdp5nhhjn",
      sku: "SARIMA-P341",
      sarimaSourceProductId: "P341",
      expectedCurrentBarcode: "YSB-SARIMA-P341",
      verifiedBarcode: "4800092116537"
    },
    {
      id: "cmtk4sg0y00zlib1gefat8q3s",
      sku: "SARIMA-P342",
      sarimaSourceProductId: "P342",
      expectedCurrentBarcode: "YSB-SARIMA-P342",
      verifiedBarcode: "4800010781076"
    },
    {
      id: "cmtk4sg220105ib1gcte2f61r",
      sku: "SARIMA-P347",
      sarimaSourceProductId: "P347",
      expectedCurrentBarcode: "YSB-SARIMA-P347",
      verifiedBarcode: "4800092551444"
    },
    {
      id: "cmtk4sg2a0109ib1gz7i71zzg",
      sku: "SARIMA-P348",
      sarimaSourceProductId: "P348",
      expectedCurrentBarcode: "YSB-SARIMA-P348",
      verifiedBarcode: "4800092551369"
    },
    {
      id: "cmtk4sg2i010dib1gd3hkh4c0",
      sku: "SARIMA-P349",
      sarimaSourceProductId: "P349",
      expectedCurrentBarcode: "YSB-SARIMA-P349",
      verifiedBarcode: "4800092550904"
    },
    {
      id: "cmtk4sg2p010hib1g8o5kgtz4",
      sku: "SARIMA-P350",
      sarimaSourceProductId: "P350",
      expectedCurrentBarcode: "YSB-SARIMA-P350",
      verifiedBarcode: "4800092553226"
    }
  ]
} as const;

async function main() {
  if (!process.argv.includes(APPLY_FLAG)) {
    throw new Error(
      `PHASE_19_SYNTHETIC_BARCODE_REHABILITATION_EXPLICIT_APPLY_REQUIRED: rerun with ${APPLY_FLAG}`
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
