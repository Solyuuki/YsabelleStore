import { prisma } from "../database/prismaClient.js";
import {
  executeExistingSarimaBarcodeEnrichment,
  type ExistingSarimaBarcodeEnrichmentClient
} from "../modules/catalog/catalog-existing-sarima-barcode-enrichment-execution.js";

const APPLY_FLAG = "--apply-approved-existing-sarima-barcode-enrichment";

const authorization = {
  identities: [
    {
      id: "prd_sarima_p022_gardenia_white_bread_600g",
      sku: "SARIMA-P022",
      name: "Gardenia Enriched White Bread 600g",
      sarimaSourceProductId: "P022",
      barcode: "4806502720615"
    },
    {
      id: "prd_sarima_p088_fresca_tuna_175g",
      sku: "SARIMA-P088",
      name: "Fresca Tuna Flakes in Oil 175g",
      sarimaSourceProductId: "P088",
      barcode: "748485900094"
    },
    {
      id: "prd_sarima_p217_wilkins_500ml",
      sku: "SARIMA-P217",
      name: "Wilkins Pure Drinking Water 500mL",
      sarimaSourceProductId: "P217",
      barcode: "4801981107971"
    },
    {
      id: "prd_sarima_p218_natures_spring_350ml",
      sku: "SARIMA-P218",
      name: "Nature's Spring Purified Drinking Water 350mL",
      sarimaSourceProductId: "P218",
      barcode: "4800049720107"
    },
    {
      id: "prd_sarima_p241_del_monte_tomato_sauce_250g",
      sku: "SARIMA-P241",
      name: "Del Monte Original Style Tomato Sauce 250g",
      sarimaSourceProductId: "P241",
      barcode: "4800024556929"
    },
    {
      id: "prd_sarima_p370_piattos_cheese_85g",
      sku: "SARIMA-P370",
      name: "Jack 'n Jill Piattos Cheese 85g",
      sarimaSourceProductId: "P370",
      barcode: "4800016644504"
    }
  ]
} as const;

async function main() {
  if (!process.argv.includes(APPLY_FLAG)) {
    throw new Error(
      `EXISTING_SARIMA_BARCODE_ENRICHMENT_EXPLICIT_APPLY_REQUIRED: rerun with ${APPLY_FLAG}`
    );
  }

  const result = await executeExistingSarimaBarcodeEnrichment({
    client: prisma as unknown as ExistingSarimaBarcodeEnrichmentClient,
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
