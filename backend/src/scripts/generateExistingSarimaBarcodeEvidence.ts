import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { prisma } from "../database/prismaClient.js";
import {
  EXISTING_SARIMA_BARCODE_EVIDENCE_IDENTITIES,
  buildExistingSarimaBarcodeEvidence,
  type ExistingSarimaBarcodeEvidence,
  type ExistingSarimaBarcodeEvidenceInput,
  type ExistingSarimaBarcodeProduct
} from "../modules/catalog/catalog-existing-sarima-barcode-evidence.js";
import { resolveRepositoryPath } from "../modules/forecasting/repository-paths.js";

const DEFAULT_JSON_PATH = resolveRepositoryPath(
  "reports/catalog-quality/phase9-existing-sarima-barcode-evidence.json"
);
const DEFAULT_REPORT_PATH = resolveRepositoryPath(
  "docs/catalog/phase9-existing-sarima-barcode-evidence.md"
);

type RawProductRow = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  recordSource: string;
  status: string;
  dataQualityStatus: string;
  isStorefrontVisible: boolean;
  sarimaSourceMapping: { sourceProductId: string } | null;
};

export type ExistingSarimaBarcodeEvidencePrismaClient = {
  product: {
    findMany(args: unknown): Promise<RawProductRow[]>;
  };
};

function source(
  sourceType: ExistingSarimaBarcodeEvidenceInput["sources"][number]["sourceType"],
  sourceName: string,
  url: string,
  observedBarcode: string | null,
  independentSourceKey: string,
  exactProductIdentity = true,
  exactRetailUnit = true
) {
  return {
    sourceType,
    sourceName,
    url,
    observedBarcode,
    exactProductIdentity,
    exactRetailUnit,
    independentSourceKey
  };
}

export const EXISTING_SARIMA_EXTERNAL_BARCODE_EVIDENCE: ExistingSarimaBarcodeEvidenceInput[] = [
  {
    productId: "prd_sarima_p022_gardenia_white_bread_600g",
    sku: "SARIMA-P022",
    sarimaSourceProductId: "P022",
    candidateBarcode: "4806502720615",
    sources: [
      source(
        "RETAILER",
        "Puregold",
        "https://puregold.com.ph/pgcatalog/product/view/title/GARDENIA%20WHITE%20BREAD%20REGULAR%20%20%20600G%20/barcode/4806502720615",
        "4806502720615",
        "puregold.com.ph"
      ),
      source(
        "RETAILER",
        "Ever Supermarket via foodpanda",
        "https://www.foodpanda.ph/shop/ncld/ever-supermarket-maligaya",
        "4806502720615",
        "ever-supermarket-foodpanda"
      )
    ]
  },
  {
    productId: "prd_sarima_p038_purefoods_tocino_450g",
    sku: "SARIMA-P038",
    sarimaSourceProductId: "P038",
    candidateBarcode: "4808887970531",
    sources: [
      source(
        "RETAILER",
        "Sta. Lucia Grocers",
        "https://staluciagrocers.com/products/purefoods-classic-tocino-450g",
        "4808887970531",
        "staluciagrocers.com"
      )
    ]
  },
  {
    productId: "prd_sarima_p054_sunsilk_anti_dandruff_135ml",
    sku: "SARIMA-P054",
    sarimaSourceProductId: "P054",
    candidateBarcode: null,
    sources: []
  },
  {
    productId: "prd_sarima_p065_dr_wongs_sulfur_soap_80g",
    sku: "SARIMA-P065",
    sarimaSourceProductId: "P065",
    candidateBarcode: "4800011179049",
    sources: [
      source(
        "MARKETPLACE",
        "eBay business seller",
        "https://www.ebay.ca/itm/116294137904",
        "4800011179049",
        "ebay-koji-beauty"
      ),
      source(
        "OTHER",
        "Neneng POS public catalog",
        "https://www.nenengpos.online/",
        "4800011179049",
        "nenengpos.online"
      )
    ]
  },
  {
    productId: "prd_sarima_p078_sunsilk_perfect_straight_13ml",
    sku: "SARIMA-P078",
    sarimaSourceProductId: "P078",
    candidateBarcode: null,
    sources: []
  },
  {
    productId: "prd_sarima_p080_colgate_maximum_cavity_74g",
    sku: "SARIMA-P080",
    sarimaSourceProductId: "P080",
    candidateBarcode: null,
    sources: []
  },
  {
    productId: "prd_sarima_p088_fresca_tuna_175g",
    sku: "SARIMA-P088",
    sarimaSourceProductId: "P088",
    candidateBarcode: "748485900094",
    sources: [
      source(
        "RETAILER",
        "Puregold",
        "https://puregold.com.ph/pgcatalog/product/view/title/FRESCA%20TUNA%20%20FLAKES%20IN%20OIL%20%20175G/barcode/748485900094",
        "748485900094",
        "puregold.com.ph"
      ),
      source(
        "RETAILER",
        "Sta. Lucia Grocers",
        "https://staluciagrocers.com/products/fresca-tuna-flakes-in-oil-175g",
        "748485900094",
        "staluciagrocers.com"
      )
    ]
  },
  {
    productId: "prd_sarima_p091_star_nutri_meats_afritada_100g",
    sku: "SARIMA-P091",
    sarimaSourceProductId: "P091",
    candidateBarcode: null,
    sources: []
  },
  {
    productId: "prd_sarima_p098_argentina_luncheon_meat_340g",
    sku: "SARIMA-P098",
    sarimaSourceProductId: "P098",
    candidateBarcode: null,
    sources: []
  },
  {
    productId: "prd_sarima_p102_ladys_choice_mayonnaise_72ml",
    sku: "SARIMA-P102",
    sarimaSourceProductId: "P102",
    candidateBarcode: null,
    sources: []
  },
  {
    productId: "prd_sarima_p217_wilkins_500ml",
    sku: "SARIMA-P217",
    sarimaSourceProductId: "P217",
    candidateBarcode: "4801981107971",
    sources: [
      source(
        "RETAILER",
        "Ever Supermarket",
        "https://ever.ph/pages/promos",
        "4801981107971",
        "ever.ph"
      ),
      source(
        "RETAILER",
        "Iloilo Supermart",
        "https://store.iloilosupermart.com/product/wilkins-pure-500ml/",
        "4801981107971",
        "store.iloilosupermart.com"
      )
    ]
  },
  {
    productId: "prd_sarima_p218_natures_spring_350ml",
    sku: "SARIMA-P218",
    sarimaSourceProductId: "P218",
    candidateBarcode: "4800049720107",
    sources: [
      source(
        "RETAILER",
        "Talcreco",
        "https://talcreco.com/consumer-goods",
        "4800049720107",
        "talcreco.com"
      ),
      source(
        "RETAILER",
        "Sta. Lucia Grocers",
        "https://staluciagrocers.com/products/natures-spring-purified-drinking-water-350ml",
        "4800049720107",
        "staluciagrocers.com"
      )
    ]
  },
  {
    productId: "prd_sarima_p237_pocari_sweat_500ml",
    sku: "SARIMA-P237",
    sarimaSourceProductId: "P237",
    candidateBarcode: null,
    sources: []
  },
  {
    productId: "prd_sarima_p241_del_monte_tomato_sauce_250g",
    sku: "SARIMA-P241",
    sarimaSourceProductId: "P241",
    candidateBarcode: "4800024556929",
    sources: [
      source(
        "RETAILER",
        "Del Monte Kitchenomics",
        "https://kitchenomics.com/del-monte-tomato-sauce-original-style-250g.html",
        "4800024556929",
        "kitchenomics.com"
      ),
      source(
        "RETAILER",
        "Iloilo Supermart",
        "https://store.iloilosupermart.com/product/del-monte-tomato-sauce-250g-sup/",
        "4800024556929",
        "store.iloilosupermart.com"
      )
    ]
  },
  {
    productId: "prd_sarima_p261_coca_cola_15l",
    sku: "SARIMA-P261",
    sarimaSourceProductId: "P261",
    candidateBarcode: "4801981116072",
    sources: [
      source(
        "RETAILER",
        "Ever Supermarket via foodpanda",
        "https://www.foodpanda.ph/shop/ncld/ever-supermarket-maligaya",
        "4801981116072",
        "ever-supermarket-foodpanda"
      )
    ]
  },
  {
    productId: "prd_sarima_p370_piattos_cheese_85g",
    sku: "SARIMA-P370",
    sarimaSourceProductId: "P370",
    candidateBarcode: "4800016644504",
    sources: [
      source(
        "RETAILER",
        "Ever Supermarket via foodpanda",
        "https://www.foodpanda.ph/shop/pc7e/ever-supermarket-paco",
        "4800016644504",
        "ever-supermarket-foodpanda"
      ),
      source(
        "RETAILER",
        "Iloilo Supermart",
        "https://store.iloilosupermart.com/product/piattos-cheese-85g/",
        "4800016644504",
        "store.iloilosupermart.com"
      )
    ]
  },
  {
    productId: "prd_sarima_p385_nescafe_classic_80g",
    sku: "SARIMA-P385",
    sarimaSourceProductId: "P385",
    candidateBarcode: null,
    sources: []
  },
  {
    productId: "prd_sarima_p425_oishi_ridges_bbq_60g",
    sku: "SARIMA-P425",
    sarimaSourceProductId: "P425",
    candidateBarcode: null,
    sources: []
  },
  {
    productId: "prd_sarima_p443_payless_yakisoba_59g",
    sku: "SARIMA-P443",
    sarimaSourceProductId: "P443",
    candidateBarcode: null,
    sources: []
  }
];

function toProduct(row: RawProductRow): ExistingSarimaBarcodeProduct {
  const sourceProductId = row.sarimaSourceMapping?.sourceProductId;
  if (!sourceProductId) {
    throw new Error(
      `EXISTING_SARIMA_BARCODE_EVIDENCE_IDENTITY_MISMATCH: ${row.id} has no SARIMA source mapping`
    );
  }

  return {
    id: row.id,
    sku: row.sku,
    sarimaSourceProductId: sourceProductId,
    name: row.name,
    barcode: row.barcode,
    recordSource: row.recordSource,
    status: row.status,
    dataQualityStatus: row.dataQualityStatus,
    isStorefrontVisible: row.isStorefrontVisible
  };
}

export function buildBarcodeEvidenceForProducts(products: ExistingSarimaBarcodeProduct[]) {
  return buildExistingSarimaBarcodeEvidence({
    products,
    evidence: EXISTING_SARIMA_EXTERNAL_BARCODE_EVIDENCE
  });
}

function toMarkdown(matrix: ExistingSarimaBarcodeEvidence) {
  const lines = [
    "# Phase 9 Existing SARIMA Barcode Evidence",
    "",
    "**READ-ONLY.** This report records external barcode evidence only. It does not update Product.barcode, Product status, storefront visibility, price, inventory, or images.",
    "",
    "## Summary",
    "",
    "| Metric | Count |",
    "| --- | ---: |",
    `| Products | ${matrix.summary.products} |`,
    `| Verified external | ${matrix.summary.verifiedExternal} |`,
    `| Needs physical scan | ${matrix.summary.needsPhysicalScan} |`,
    `| Conflicting evidence | ${matrix.summary.conflictingEvidence} |`,
    `| Not found | ${matrix.summary.notFound} |`,
    "",
    "## Evidence",
    "",
    "| SARIMA | Product | Status | Candidate | Verified | Sources |",
    "| --- | --- | --- | --- | --- | ---: |",
    ...matrix.rows.map(
      (row) =>
        `| ${row.sarimaSourceProductId} | ${row.name.replaceAll("|", "\\|")} | ${row.status} | ${row.candidateBarcode ?? "-"} | ${row.verifiedBarcode ?? "-"} | ${row.sourceCount} |`
    ),
    "",
    "Policy: a checksum-valid GTIN is VERIFIED_EXTERNAL only when supported by an exact product/exact retail-unit manufacturer or authorized-distributor source, or by at least two independent exact-unit retailer sources. Marketplace-only, single-retailer, ambiguous pack-unit, or unsupported candidates remain unresolved for physical scan.",
    ""
  ];
  return lines.join("\n");
}

async function writeText(filePath: string, contents: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, contents, "utf8");
}

export async function generateExistingSarimaBarcodeEvidence(
  options: {
    client?: ExistingSarimaBarcodeEvidencePrismaClient;
    jsonPath?: string;
    reportPath?: string;
  } = {}
) {
  const client = options.client ?? (prisma as unknown as ExistingSarimaBarcodeEvidencePrismaClient);
  const ids = EXISTING_SARIMA_BARCODE_EVIDENCE_IDENTITIES.map((row) => row.id);

  const rawProducts = await client.product.findMany({
    where: { id: { in: ids } },
    orderBy: { id: "asc" },
    select: {
      id: true,
      sku: true,
      barcode: true,
      name: true,
      recordSource: true,
      status: true,
      dataQualityStatus: true,
      isStorefrontVisible: true,
      sarimaSourceMapping: { select: { sourceProductId: true } }
    }
  });

  if (rawProducts.length !== ids.length) {
    throw new Error(
      `EXISTING_SARIMA_BARCODE_EVIDENCE_IDENTITY_MISMATCH: expected ${ids.length} products, found ${rawProducts.length}`
    );
  }

  const products = rawProducts.map(toProduct);
  const matrix = buildBarcodeEvidenceForProducts(products);
  const jsonPath = options.jsonPath ?? DEFAULT_JSON_PATH;
  const reportPath = options.reportPath ?? DEFAULT_REPORT_PATH;

  await Promise.all([
    writeText(jsonPath, `${JSON.stringify(matrix, null, 2)}\n`),
    writeText(reportPath, `${toMarkdown(matrix)}\n`)
  ]);

  return matrix;
}

function isDirectExecution() {
  const entryPoint = process.argv[1];
  return (
    Boolean(entryPoint) &&
    path.resolve(entryPoint!) === path.resolve(fileURLToPath(import.meta.url))
  );
}

if (isDirectExecution()) {
  try {
    const matrix = await generateExistingSarimaBarcodeEvidence();
    console.log(JSON.stringify(matrix, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}
