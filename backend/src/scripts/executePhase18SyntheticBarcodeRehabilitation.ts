import { prisma } from "../database/prismaClient.js";
import {
  executeSyntheticBarcodeRehabilitation,
  type SyntheticBarcodeRehabilitationClient
} from "../modules/catalog/catalog-synthetic-barcode-rehabilitation-execution.js";

const APPLY_FLAG = "--apply-phase-18-synthetic-barcode-rehabilitation";

const authorization = {
  identities: [
    {
      id: "cmtk4sfoq00txib1g34o9bhhu",
      sku: "SARIMA-P291",
      sarimaSourceProductId: "P291",
      expectedCurrentBarcode: "YSB-SARIMA-P291",
      verifiedBarcode: "4806521791696"
    },
    {
      id: "cmtk4sfp200u1ib1gy1ycwfqa",
      sku: "SARIMA-P292",
      sarimaSourceProductId: "P292",
      expectedCurrentBarcode: "YSB-SARIMA-P292",
      verifiedBarcode: "4806521793836"
    },
    {
      id: "cmtk4sfpa00u5ib1gbpev1tmi",
      sku: "SARIMA-P293",
      sarimaSourceProductId: "P293",
      expectedCurrentBarcode: "YSB-SARIMA-P293",
      verifiedBarcode: "4800016627262"
    },
    {
      id: "cmtk4sfps00udib1g7rgqc1d1",
      sku: "SARIMA-P295",
      sarimaSourceProductId: "P295",
      expectedCurrentBarcode: "YSB-SARIMA-P295",
      verifiedBarcode: "4800016628269"
    },
    {
      id: "cmtk4sfqj00upib1ga6p6o0k9",
      sku: "SARIMA-P298",
      sarimaSourceProductId: "P298",
      expectedCurrentBarcode: "YSB-SARIMA-P298",
      verifiedBarcode: "4800016635809"
    },
    {
      id: "cmtk4sfr300uxib1giyj5vejy",
      sku: "SARIMA-P300",
      sarimaSourceProductId: "P300",
      expectedCurrentBarcode: "YSB-SARIMA-P300",
      verifiedBarcode: "4800016625534"
    },
    {
      id: "cmtk4sfs100vdib1gq7um2p8c",
      sku: "SARIMA-P304",
      sarimaSourceProductId: "P304",
      expectedCurrentBarcode: "YSB-SARIMA-P304",
      verifiedBarcode: "4800016110528"
    },
    {
      id: "cmtk4sfsi00vlib1g20lqy55r",
      sku: "SARIMA-P306",
      sarimaSourceProductId: "P306",
      expectedCurrentBarcode: "YSB-SARIMA-P306",
      verifiedBarcode: "4800194180184"
    },
    {
      id: "cmtk4sfy800ydib1gbfrpb82l",
      sku: "SARIMA-P331",
      sarimaSourceProductId: "P331",
      expectedCurrentBarcode: "YSB-SARIMA-P331",
      verifiedBarcode: "4801688881419"
    },
    {
      id: "cmtk4sfyt00ylib1g2b15xz6r",
      sku: "SARIMA-P333",
      sarimaSourceProductId: "P333",
      expectedCurrentBarcode: "YSB-SARIMA-P333",
      verifiedBarcode: "4800194107945"
    }
  ]
} as const;

async function main() {
  if (!process.argv.includes(APPLY_FLAG)) {
    throw new Error(
      `PHASE_18_SYNTHETIC_BARCODE_REHABILITATION_EXPLICIT_APPLY_REQUIRED: rerun with ${APPLY_FLAG}`
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
