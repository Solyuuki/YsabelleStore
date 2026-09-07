import { prisma } from "../database/prismaClient.js";

const VERIFIED_BARCODES = [
  {
    id: "prd_sarima_p022_gardenia_white_bread_600g",
    sku: "SARIMA-P022",
    name: "Gardenia Enriched White Bread 600g",
    sarimaSourceProductId: "P022",
    barcode: "4806502720615",
    evidence: "existing approved YsabelleStore barcode enrichment"
  },
  {
    id: "prd_sarima_p065_dr_wongs_sulfur_soap_80g",
    sku: "SARIMA-P065",
    name: "Dr. Wong's Sulfur Soap 80g",
    sarimaSourceProductId: "P065",
    barcode: "4800011179049",
    evidence: "verified exact 80g Dr. Wong's Sulfur Soap retail unit from Philippine retailer listings"
  },
  {
    id: "prd_sarima_p078_sunsilk_perfect_straight_13ml",
    sku: "SARIMA-P078",
    name: "Sunsilk Perfect Straight Shampoo Sachet 13mL",
    sarimaSourceProductId: "P078",
    barcode: "4800888191939",
    evidence: "verified exact Sunsilk Perfect Straight 13mL sachet retail unit from Philippine retailer listings"
  },
  {
    id: "prd_sarima_p088_fresca_tuna_175g",
    sku: "SARIMA-P088",
    name: "Fresca Tuna Flakes in Oil 175g",
    sarimaSourceProductId: "P088",
    barcode: "748485900094",
    evidence: "existing approved YsabelleStore barcode enrichment"
  },
  {
    id: "prd_sarima_p144_ligo_sardines_155g",
    sku: "SARIMA-P144",
    name: "Ligo Sardines in Tomato Sauce Chili Added",
    sarimaSourceProductId: "P144",
    barcode: "072810293606",
    evidence:
      "verified exact 155g chili-added retail unit from CEE distributor catalog and independent retailer listings"
  },
  {
    id: "prd_sarima_p217_wilkins_500ml",
    sku: "SARIMA-P217",
    name: "Wilkins Pure Drinking Water 500mL",
    sarimaSourceProductId: "P217",
    barcode: "4801981107971",
    evidence: "existing approved YsabelleStore barcode enrichment"
  },
  {
    id: "prd_sarima_p218_natures_spring_350ml",
    sku: "SARIMA-P218",
    name: "Nature's Spring Purified Drinking Water 350mL",
    sarimaSourceProductId: "P218",
    barcode: "4800049720107",
    evidence: "existing approved YsabelleStore barcode enrichment"
  },
  {
    id: "prd_sarima_p237_pocari_sweat_500ml",
    sku: "SARIMA-P237",
    name: "Pocari Sweat 500mL",
    sarimaSourceProductId: "P237",
    barcode: "8997035563414",
    evidence: "verified exact Pocari Sweat 500mL bottle retail unit from multiple retailer listings"
  },
  {
    id: "prd_sarima_p241_del_monte_tomato_sauce_250g",
    sku: "SARIMA-P241",
    name: "Del Monte Original Style Tomato Sauce 250g",
    sarimaSourceProductId: "P241",
    barcode: "4800024556929",
    evidence: "existing approved YsabelleStore barcode enrichment"
  },
  {
    id: "prd_sarima_p261_coca_cola_15l",
    sku: "SARIMA-P261",
    name: "Coca-Cola 1.5L",
    sarimaSourceProductId: "P261",
    barcode: "4801981116072",
    evidence:
      "verified Philippine 1.5L Coca-Cola Original Taste Less Sugar retail unit from Ever Supermarket and independent local retailer listings"
  },
  {
    id: "prd_sarima_p370_piattos_cheese_85g",
    sku: "SARIMA-P370",
    name: "Jack 'n Jill Piattos Cheese 85g",
    sarimaSourceProductId: "P370",
    barcode: "4800016644504",
    evidence: "existing approved YsabelleStore barcode enrichment"
  },
  {
    id: "prd_sarima_p385_nescafe_classic_80g",
    sku: "SARIMA-P385",
    name: "Nescafe Classic 80g",
    sarimaSourceProductId: "P385",
    barcode: "4800361393683",
    evidence: "verified exact Nescafe Classic 80g retail unit from Philippine retailer listings"
  }
] as const;

export type CatalogKnownBarcodeBootstrapResult = {
  alreadyPresent: number;
  missingProducts: number;
  updated: number;
};

export async function ensureKnownCatalogBarcodes(): Promise<CatalogKnownBarcodeBootstrapResult> {
  return prisma.$transaction(async (tx) => {
    const ids = VERIFIED_BARCODES.map((entry) => entry.id);
    const rows = await tx.product.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        sku: true,
        name: true,
        barcode: true,
        recordSource: true,
        sarimaSourceMapping: { select: { sourceProductId: true } }
      }
    });
    const rowById = new Map(rows.map((row) => [row.id, row]));

    let alreadyPresent = 0;
    let missingProducts = 0;
    let updated = 0;

    for (const entry of VERIFIED_BARCODES) {
      const row = rowById.get(entry.id);

      if (!row) {
        missingProducts += 1;
        continue;
      }

      if (
        row.sku !== entry.sku ||
        row.name !== entry.name ||
        row.recordSource !== "IMPORT" ||
        row.sarimaSourceMapping?.sourceProductId !== entry.sarimaSourceProductId
      ) {
        throw new Error(
          `CATALOG_KNOWN_BARCODE_IDENTITY_MISMATCH: ${entry.id} no longer matches the verified catalog identity.`
        );
      }

      if (row.barcode === entry.barcode) {
        alreadyPresent += 1;
        continue;
      }

      if (row.barcode !== null) {
        throw new Error(
          `CATALOG_KNOWN_BARCODE_CONFLICT: ${entry.id} already has a different barcode (${row.barcode}).`
        );
      }

      const collision = await tx.product.findFirst({
        where: {
          barcode: entry.barcode,
          id: { not: entry.id }
        },
        select: { id: true, sku: true }
      });

      if (collision) {
        throw new Error(
          `CATALOG_KNOWN_BARCODE_COLLISION: ${entry.barcode} is already assigned to ${collision.sku} (${collision.id}).`
        );
      }

      const result = await tx.product.updateMany({
        where: {
          id: entry.id,
          sku: entry.sku,
          barcode: null,
          recordSource: "IMPORT"
        },
        data: { barcode: entry.barcode }
      });

      if (result.count !== 1) {
        throw new Error(
          `CATALOG_KNOWN_BARCODE_WRITE_MISMATCH: ${entry.id} barcode update affected ${result.count} rows.`
        );
      }

      await tx.catalogAuditLog.create({
        data: {
          action: "VERIFIED_BARCODE_BACKFILL",
          automated: true,
          actor: "backend-startup",
          canonicalProductId: entry.id,
          entityId: entry.id,
          entityType: "PRODUCT",
          evidence: {
            barcode: entry.barcode,
            evidence: entry.evidence,
            sarimaSourceProductId: entry.sarimaSourceProductId,
            sku: entry.sku
          },
          reason: "Backfilled a verified barcode onto an exact catalog identity with no existing barcode."
        }
      });

      updated += 1;
    }

    return { alreadyPresent, missingProducts, updated };
  });
}
