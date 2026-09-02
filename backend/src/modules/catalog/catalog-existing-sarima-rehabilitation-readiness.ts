export type ExistingSarimaRehabilitationIdentity = {
  id: string;
  sku: string;
  sarimaSourceProductId: string;
};

export const EXISTING_SARIMA_REHABILITATION_IDENTITIES = [
  { id: "prd_sarima_p022_gardenia_white_bread_600g", sku: "SARIMA-P022", sarimaSourceProductId: "P022" },
  { id: "prd_sarima_p038_purefoods_tocino_450g", sku: "SARIMA-P038", sarimaSourceProductId: "P038" },
  { id: "prd_sarima_p054_sunsilk_anti_dandruff_135ml", sku: "SARIMA-P054", sarimaSourceProductId: "P054" },
  { id: "prd_sarima_p065_dr_wongs_sulfur_soap_80g", sku: "SARIMA-P065", sarimaSourceProductId: "P065" },
  { id: "prd_sarima_p078_sunsilk_perfect_straight_13ml", sku: "SARIMA-P078", sarimaSourceProductId: "P078" },
  { id: "prd_sarima_p080_colgate_maximum_cavity_74g", sku: "SARIMA-P080", sarimaSourceProductId: "P080" },
  { id: "prd_sarima_p088_fresca_tuna_175g", sku: "SARIMA-P088", sarimaSourceProductId: "P088" },
  { id: "prd_sarima_p091_star_nutri_meats_afritada_100g", sku: "SARIMA-P091", sarimaSourceProductId: "P091" },
  { id: "prd_sarima_p098_argentina_luncheon_meat_340g", sku: "SARIMA-P098", sarimaSourceProductId: "P098" },
  { id: "prd_sarima_p102_ladys_choice_mayonnaise_72ml", sku: "SARIMA-P102", sarimaSourceProductId: "P102" },
  { id: "prd_sarima_p144_ligo_sardines_155g", sku: "SARIMA-P144", sarimaSourceProductId: "P144" },
  { id: "prd_sarima_p217_wilkins_500ml", sku: "SARIMA-P217", sarimaSourceProductId: "P217" },
  { id: "prd_sarima_p218_natures_spring_350ml", sku: "SARIMA-P218", sarimaSourceProductId: "P218" },
  { id: "prd_sarima_p237_pocari_sweat_500ml", sku: "SARIMA-P237", sarimaSourceProductId: "P237" },
  { id: "prd_sarima_p241_del_monte_tomato_sauce_250g", sku: "SARIMA-P241", sarimaSourceProductId: "P241" },
  { id: "prd_sarima_p261_coca_cola_15l", sku: "SARIMA-P261", sarimaSourceProductId: "P261" },
  { id: "prd_sarima_p370_piattos_cheese_85g", sku: "SARIMA-P370", sarimaSourceProductId: "P370" },
  { id: "prd_sarima_p385_nescafe_classic_80g", sku: "SARIMA-P385", sarimaSourceProductId: "P385" },
  { id: "prd_sarima_p425_oishi_ridges_bbq_60g", sku: "SARIMA-P425", sarimaSourceProductId: "P425" },
  { id: "prd_sarima_p443_payless_yakisoba_59g", sku: "SARIMA-P443", sarimaSourceProductId: "P443" }
] as const satisfies readonly ExistingSarimaRehabilitationIdentity[];

export type ExistingSarimaRehabilitationProduct = {
  id: string;
  sku: string;
  barcode: string | null;
  name: string;
  recordSource: string;
  status: string;
  dataQualityStatus: string;
  isStorefrontVisible: boolean;
  sarimaSourceProductId: string | null;
  existingImageAssetCount: number;
};

export type ExistingSarimaPromotionEvidence = {
  productCode: string;
  identityStatus: "CANONICAL" | "DUPLICATE_ALIAS" | "BLOCKED_REVIEW";
  canonicalProductCode: string;
  imageStatus: "EXACT_MATCH" | "NEEDS_REVIEW" | "VARIANT_SIZE_MISMATCH" | "DUPLICATE_IMAGE" | "MISSING_IMAGE";
  assetFileIds: string[];
  identityReason: string;
  imageReason: string;
};

export type ExistingSarimaRehabilitationRow = {
  productId: string;
  sku: string;
  sarimaSourceProductId: string;
  name: string;
  barcode: string | null;
  barcodeReadiness: "NEEDS_VERIFIED_SOURCE" | "PRESENT_UNVERIFIED";
  existingImageAssetCount: number;
  catalogImageStatus: ExistingSarimaPromotionEvidence["imageStatus"];
  catalogImageAssetFileIds: string[];
  catalogImageReason: string;
  identityStatus: ExistingSarimaPromotionEvidence["identityStatus"];
  canonicalProductCode: string;
  identityReadiness: "CLEAR" | "BLOCKED";
  identityReason: string;
};

export type ExistingSarimaRehabilitationReadiness = {
  summary: {
    products: number;
    barcodeMissing: number;
    barcodePresentUnverified: number;
    identityClear: number;
    identityBlocked: number;
    imageExactMatch: number;
    imageNeedsReview: number;
    imageVariantSizeMismatch: number;
    imageDuplicate: number;
    imageMissing: number;
    databaseImageAssets: number;
    catalogImageCandidateAssets: number;
  };
  rows: ExistingSarimaRehabilitationRow[];
};

function fail(code: string, detail: string): never {
  throw new Error(`${code}: ${detail}`);
}

export function buildExistingSarimaRehabilitationReadiness(input: {
  identities: readonly ExistingSarimaRehabilitationIdentity[];
  products: ExistingSarimaRehabilitationProduct[];
  promotionRows: ExistingSarimaPromotionEvidence[];
}): ExistingSarimaRehabilitationReadiness {
  const ids = input.identities.map((row) => row.id);
  const idSet = new Set(ids);
  if (idSet.size !== ids.length) {
    fail("EXISTING_SARIMA_REHABILITATION_IDENTITY_MISMATCH", "identity allowlist contains duplicate product ids");
  }

  if (input.products.length !== input.identities.length) {
    fail(
      "EXISTING_SARIMA_REHABILITATION_IDENTITY_MISMATCH",
      `expected ${input.identities.length} products, found ${input.products.length}`
    );
  }

  const productById = new Map(input.products.map((row) => [row.id, row]));
  const promotionByCode = new Map(input.promotionRows.map((row) => [row.productCode, row]));

  const rows = input.identities.map((identity): ExistingSarimaRehabilitationRow => {
    const product = productById.get(identity.id);
    if (!product || product.sku !== identity.sku || product.sarimaSourceProductId !== identity.sarimaSourceProductId) {
      fail(
        "EXISTING_SARIMA_REHABILITATION_IDENTITY_MISMATCH",
        `${identity.id} no longer matches approved product/SARIMA identity`
      );
    }

    if (
      product.recordSource !== "IMPORT" ||
      product.status !== "INACTIVE" ||
      product.dataQualityStatus !== "NEEDS_REVIEW" ||
      product.isStorefrontVisible !== false
    ) {
      fail(
        "EXISTING_SARIMA_REHABILITATION_STATE_MISMATCH",
        `${identity.id} must remain IMPORT + INACTIVE + NEEDS_REVIEW + storefront hidden during rehabilitation`
      );
    }

    const promotion = promotionByCode.get(identity.sarimaSourceProductId);
    if (!promotion) {
      fail(
        "EXISTING_SARIMA_REHABILITATION_IDENTITY_MISMATCH",
        `missing promotion/image reconciliation evidence for ${identity.sarimaSourceProductId}`
      );
    }

    return {
      productId: product.id,
      sku: product.sku,
      sarimaSourceProductId: identity.sarimaSourceProductId,
      name: product.name,
      barcode: product.barcode,
      barcodeReadiness: product.barcode ? "PRESENT_UNVERIFIED" : "NEEDS_VERIFIED_SOURCE",
      existingImageAssetCount: product.existingImageAssetCount,
      catalogImageStatus: promotion.imageStatus,
      catalogImageAssetFileIds: [...promotion.assetFileIds].sort(),
      catalogImageReason: promotion.imageReason,
      identityStatus: promotion.identityStatus,
      canonicalProductCode: promotion.canonicalProductCode,
      identityReadiness: promotion.identityStatus === "CANONICAL" ? "CLEAR" : "BLOCKED",
      identityReason: promotion.identityReason
    };
  });

  const countImageStatus = (status: ExistingSarimaPromotionEvidence["imageStatus"]) =>
    rows.filter((row) => row.catalogImageStatus === status).length;

  return {
    summary: {
      products: rows.length,
      barcodeMissing: rows.filter((row) => row.barcodeReadiness === "NEEDS_VERIFIED_SOURCE").length,
      barcodePresentUnverified: rows.filter((row) => row.barcodeReadiness === "PRESENT_UNVERIFIED").length,
      identityClear: rows.filter((row) => row.identityReadiness === "CLEAR").length,
      identityBlocked: rows.filter((row) => row.identityReadiness === "BLOCKED").length,
      imageExactMatch: countImageStatus("EXACT_MATCH"),
      imageNeedsReview: countImageStatus("NEEDS_REVIEW"),
      imageVariantSizeMismatch: countImageStatus("VARIANT_SIZE_MISMATCH"),
      imageDuplicate: countImageStatus("DUPLICATE_IMAGE"),
      imageMissing: countImageStatus("MISSING_IMAGE"),
      databaseImageAssets: rows.reduce((total, row) => total + row.existingImageAssetCount, 0),
      catalogImageCandidateAssets: rows.reduce((total, row) => total + row.catalogImageAssetFileIds.length, 0)
    },
    rows
  };
}
