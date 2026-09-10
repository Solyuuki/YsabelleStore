import { prisma } from "../database/prismaClient.js";
import {
  executeApprovedImportDemotion,
  type ApprovedImportDemotionClient
} from "../modules/catalog/catalog-approved-import-demotion.js";

const APPLY_FLAG = "--apply-approved-import-demotion";

const authorization = {
  identities: [
    {
      id: "prd_sarima_p022_gardenia_white_bread_600g",
      sku: "SARIMA-P022",
      sarimaSourceProductId: "P022",
      expectedStorefrontVisible: true
    },
    {
      id: "prd_sarima_p038_purefoods_tocino_450g",
      sku: "SARIMA-P038",
      sarimaSourceProductId: "P038",
      expectedStorefrontVisible: true
    },
    {
      id: "prd_sarima_p054_sunsilk_anti_dandruff_135ml",
      sku: "SARIMA-P054",
      sarimaSourceProductId: "P054",
      expectedStorefrontVisible: true
    },
    {
      id: "prd_sarima_p065_dr_wongs_sulfur_soap_80g",
      sku: "SARIMA-P065",
      sarimaSourceProductId: "P065",
      expectedStorefrontVisible: true
    },
    {
      id: "prd_sarima_p080_colgate_maximum_cavity_74g",
      sku: "SARIMA-P080",
      sarimaSourceProductId: "P080",
      expectedStorefrontVisible: true
    },
    {
      id: "prd_sarima_p088_fresca_tuna_175g",
      sku: "SARIMA-P088",
      sarimaSourceProductId: "P088",
      expectedStorefrontVisible: true
    },
    {
      id: "prd_sarima_p091_star_nutri_meats_afritada_100g",
      sku: "SARIMA-P091",
      sarimaSourceProductId: "P091",
      expectedStorefrontVisible: true
    },
    {
      id: "prd_sarima_p098_argentina_luncheon_meat_340g",
      sku: "SARIMA-P098",
      sarimaSourceProductId: "P098",
      expectedStorefrontVisible: true
    },
    {
      id: "prd_sarima_p102_ladys_choice_mayonnaise_72ml",
      sku: "SARIMA-P102",
      sarimaSourceProductId: "P102",
      expectedStorefrontVisible: true
    },
    {
      id: "prd_sarima_p144_ligo_sardines_155g",
      sku: "SARIMA-P144",
      sarimaSourceProductId: "P144",
      expectedStorefrontVisible: true
    },
    {
      id: "prd_sarima_p217_wilkins_500ml",
      sku: "SARIMA-P217",
      sarimaSourceProductId: "P217",
      expectedStorefrontVisible: true
    },
    {
      id: "prd_sarima_p218_natures_spring_350ml",
      sku: "SARIMA-P218",
      sarimaSourceProductId: "P218",
      expectedStorefrontVisible: true
    },
    {
      id: "prd_sarima_p237_pocari_sweat_500ml",
      sku: "SARIMA-P237",
      sarimaSourceProductId: "P237",
      expectedStorefrontVisible: true
    },
    {
      id: "prd_sarima_p241_del_monte_tomato_sauce_250g",
      sku: "SARIMA-P241",
      sarimaSourceProductId: "P241",
      expectedStorefrontVisible: true
    },
    {
      id: "prd_sarima_p261_coca_cola_15l",
      sku: "SARIMA-P261",
      sarimaSourceProductId: "P261",
      expectedStorefrontVisible: true
    },
    {
      id: "prd_sarima_p370_piattos_cheese_85g",
      sku: "SARIMA-P370",
      sarimaSourceProductId: "P370",
      expectedStorefrontVisible: true
    },
    {
      id: "prd_sarima_p385_nescafe_classic_80g",
      sku: "SARIMA-P385",
      sarimaSourceProductId: "P385",
      expectedStorefrontVisible: true
    },
    {
      id: "prd_sarima_p425_oishi_ridges_bbq_60g",
      sku: "SARIMA-P425",
      sarimaSourceProductId: "P425",
      expectedStorefrontVisible: true
    },
    {
      id: "prd_sarima_p443_payless_yakisoba_59g",
      sku: "SARIMA-P443",
      sarimaSourceProductId: "P443",
      expectedStorefrontVisible: true
    },
    {
      id: "prd_sarima_p078_sunsilk_perfect_straight_13ml",
      sku: "SARIMA-P078",
      sarimaSourceProductId: "P078",
      expectedStorefrontVisible: false
    }
  ]
} as const;

async function main() {
  if (!process.argv.includes(APPLY_FLAG)) {
    throw new Error(`APPROVED_IMPORT_DEMOTION_EXPLICIT_APPLY_REQUIRED: rerun with ${APPLY_FLAG}`);
  }

  const result = await executeApprovedImportDemotion({
    client: prisma as unknown as ApprovedImportDemotionClient,
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
