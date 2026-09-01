import type { DriveImageAsset } from "./drive-image-manifest.js";
import type { SarimaSourceIdentity } from "./sarima-source-manifest.js";

export type ImageReconciliationStatus =
  | "EXACT_MATCH"
  | "NEEDS_REVIEW"
  | "VARIANT_SIZE_MISMATCH"
  | "DUPLICATE_IMAGE"
  | "MISSING_IMAGE";

export type SourceImageOutcome = {
  productCode: string;
  sourceName: string;
  sourceNameNormalized: string;
  status: ImageReconciliationStatus;
  assetFileIds: string[];
  reason: string;
};

export type DriveOnlyAssetOutcome = {
  fileId: string;
  filename: string;
  folderId: string;
  folderName: string;
  normalizedStem: string;
  status: "DRIVE_ONLY";
  reason: string;
};

export type CatalogImageReconciliation = {
  sourceOutcomes: SourceImageOutcome[];
  driveOnlyAssets: DriveOnlyAssetOutcome[];
};

const QUANTITY_TOKEN = /^\d+(?:\.\d+)?(?:g|kg|ml|l|oz|pcs?|packs?|s)$/i;
const GENERIC_IDENTITY_TOKENS = new Set([
  "bottle",
  "bottled",
  "box",
  "can",
  "drink",
  "drinking",
  "pack",
  "sachet",
  "small",
  "large",
  "water"
]);

function tokens(value: string) {
  return value.split(" ").filter(Boolean);
}

function tokenSignature(value: string) {
  return [...tokens(value)].sort().join(" ");
}

function quantityTokens(value: string) {
  return tokens(value).filter((token) => QUANTITY_TOKEN.test(token));
}

function withoutQuantities(value: string) {
  return tokens(value).filter((token) => !QUANTITY_TOKEN.test(token));
}

function sameTokens(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((value, index) => value === b[index]);
}

function sharedTokenCount(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return new Set(left.filter((token) => rightSet.has(token))).size;
}

function sameProductFamilyWithMissingSizeEvidence(source: string, image: string) {
  const sourceQuantities = quantityTokens(source);
  const imageQuantities = quantityTokens(image);
  if ((sourceQuantities.length === 0) === (imageQuantities.length === 0)) return false;
  return sameTokens(withoutQuantities(source), withoutQuantities(image));
}

function sameProductFamilyWithSizeConflict(source: string, image: string) {
  const sourceQuantities = quantityTokens(source);
  const imageQuantities = quantityTokens(image);
  if (sourceQuantities.length === 0 || imageQuantities.length === 0) return false;
  if (sameTokens(sourceQuantities, imageQuantities)) return false;
  return sameTokens(withoutQuantities(source), withoutQuantities(image));
}

function sameProductFamilyWithVariantConflict(source: string, image: string) {
  const sourceTokens = withoutQuantities(source);
  const imageTokens = withoutQuantities(image);
  if (sourceTokens.length < 3 || imageTokens.length < 3) return false;
  if (sameTokens(sourceTokens, imageTokens)) return false;

  const minLength = Math.min(sourceTokens.length, imageTokens.length);
  const commonPrefixLength = sourceTokens.findIndex(
    (token, index) => index >= imageTokens.length || token !== imageTokens[index]
  );
  const prefixLength = commonPrefixLength === -1 ? minLength : commonPrefixLength;

  return prefixLength >= 2 && sharedTokenCount(sourceTokens, imageTokens) >= 2;
}

function isGenericSourceIdentity(source: string) {
  const sourceTokens = withoutQuantities(source);
  return (
    sourceTokens.length <= 3 &&
    sourceTokens.some((token) => GENERIC_IDENTITY_TOKENS.has(token))
  );
}

function looksRelatedToGenericSource(source: string, image: string) {
  if (!isGenericSourceIdentity(source)) return false;
  const sourceTokens = withoutQuantities(source);
  const imageTokens = withoutQuantities(image);
  const meaningful = sourceTokens.filter((token) => !GENERIC_IDENTITY_TOKENS.has(token));

  if (meaningful.length > 0) {
    return meaningful.every((token) => imageTokens.includes(token));
  }

  return sourceTokens.some((token) => imageTokens.includes(token));
}

function sortedFileIds(assets: DriveImageAsset[]) {
  return assets.map((asset) => asset.fileId).sort();
}

function sourceOutcome(
  source: SarimaSourceIdentity,
  status: ImageReconciliationStatus,
  assets: DriveImageAsset[],
  reason: string
): SourceImageOutcome {
  return {
    productCode: source.productCode,
    sourceName: source.sourceName,
    sourceNameNormalized: source.sourceNameNormalized,
    status,
    assetFileIds: sortedFileIds(assets),
    reason
  };
}

function sourceSignatureGroups(sources: SarimaSourceIdentity[]) {
  const groups = new Map<string, SarimaSourceIdentity[]>();

  for (const source of sources) {
    const signature = tokenSignature(source.sourceNameNormalized);
    const group = groups.get(signature) ?? [];
    group.push(source);
    groups.set(signature, group);
  }

  return groups;
}

export function reconcileCatalogImages(
  sources: SarimaSourceIdentity[],
  images: DriveImageAsset[]
): CatalogImageReconciliation {
  const claimedFileIds = new Set<string>();
  const outcomes = new Map<string, SourceImageOutcome>();

  const orderedSources = [...sources].sort((left, right) =>
    left.productCode.localeCompare(right.productCode)
  );
  const orderedImages = [...images].sort((left, right) => left.fileId.localeCompare(right.fileId));
  const signatureGroups = sourceSignatureGroups(orderedSources);

  for (const source of orderedSources) {
    const exact = orderedImages.filter(
      (image) =>
        !claimedFileIds.has(image.fileId) &&
        image.normalizedStem === source.sourceNameNormalized
    );

    if (exact.length === 1) {
      exact.forEach((image) => claimedFileIds.add(image.fileId));
      outcomes.set(
        source.productCode,
        sourceOutcome(source, "EXACT_MATCH", exact, "Normalized source and Drive identities match exactly.")
      );
    } else if (exact.length > 1) {
      exact.forEach((image) => claimedFileIds.add(image.fileId));
      outcomes.set(
        source.productCode,
        sourceOutcome(
          source,
          "DUPLICATE_IMAGE",
          exact,
          "Multiple Drive assets normalize to the same source identity."
        )
      );
    }
  }

  for (const source of orderedSources) {
    if (outcomes.has(source.productCode)) continue;

    const signaturePeers = (signatureGroups.get(tokenSignature(source.sourceNameNormalized)) ?? [])
      .filter((peer) => peer.productCode !== source.productCode);
    const resolvedPeerCodes = signaturePeers
      .filter((peer) => outcomes.has(peer.productCode))
      .map((peer) => peer.productCode)
      .sort();

    if (resolvedPeerCodes.length > 0) {
      outcomes.set(
        source.productCode,
        sourceOutcome(
          source,
          "NEEDS_REVIEW",
          [],
          `Token-equivalent historical source identity overlaps ${resolvedPeerCodes.join(", ")}; review source identity before assigning another Drive image.`
        )
      );
      continue;
    }

    const available = orderedImages.filter((image) => !claimedFileIds.has(image.fileId));
    const reorderedExact = available.filter((image) =>
      sameTokens(tokens(source.sourceNameNormalized), tokens(image.normalizedStem))
    );

    if (reorderedExact.length === 1) {
      reorderedExact.forEach((image) => claimedFileIds.add(image.fileId));
      outcomes.set(
        source.productCode,
        sourceOutcome(
          source,
          "EXACT_MATCH",
          reorderedExact,
          "Source and Drive identities contain the same normalized identity tokens in a different order."
        )
      );
      continue;
    }

    if (reorderedExact.length > 1) {
      reorderedExact.forEach((image) => claimedFileIds.add(image.fileId));
      outcomes.set(
        source.productCode,
        sourceOutcome(
          source,
          "DUPLICATE_IMAGE",
          reorderedExact,
          "Multiple Drive assets contain the same normalized source identity tokens."
        )
      );
      continue;
    }

    const missingSizeEvidence = available.filter((image) =>
      sameProductFamilyWithMissingSizeEvidence(source.sourceNameNormalized, image.normalizedStem)
    );

    if (missingSizeEvidence.length > 0) {
      missingSizeEvidence.forEach((image) => claimedFileIds.add(image.fileId));
      outcomes.set(
        source.productCode,
        sourceOutcome(
          source,
          "NEEDS_REVIEW",
          missingSizeEvidence,
          "Product-family identity agrees, but size/package evidence is present on only one side."
        )
      );
      continue;
    }

    const sizeConflicts = available.filter((image) =>
      sameProductFamilyWithSizeConflict(source.sourceNameNormalized, image.normalizedStem)
    );

    if (sizeConflicts.length > 0) {
      sizeConflicts.forEach((image) => claimedFileIds.add(image.fileId));
      outcomes.set(
        source.productCode,
        sourceOutcome(
          source,
          "VARIANT_SIZE_MISMATCH",
          sizeConflicts,
          "Drive asset is in the same normalized product family but package-size evidence conflicts."
        )
      );
      continue;
    }

    const variantConflicts = available.filter((image) =>
      sameProductFamilyWithVariantConflict(source.sourceNameNormalized, image.normalizedStem)
    );

    if (variantConflicts.length > 0) {
      variantConflicts.forEach((image) => claimedFileIds.add(image.fileId));
      outcomes.set(
        source.productCode,
        sourceOutcome(
          source,
          "VARIANT_SIZE_MISMATCH",
          variantConflicts,
          "Drive asset is in the same normalized product family but variant/flavor evidence conflicts."
        )
      );
      continue;
    }

    const reviewCandidates = available.filter((image) =>
      looksRelatedToGenericSource(source.sourceNameNormalized, image.normalizedStem)
    );

    if (reviewCandidates.length > 0) {
      reviewCandidates.forEach((image) => claimedFileIds.add(image.fileId));
      outcomes.set(
        source.productCode,
        sourceOutcome(
          source,
          "NEEDS_REVIEW",
          reviewCandidates,
          "Generic source identity has related Drive assets but insufficient evidence for automatic assignment."
        )
      );
      continue;
    }

    outcomes.set(
      source.productCode,
      sourceOutcome(source, "MISSING_IMAGE", [], "No defensible Drive image candidate was found.")
    );
  }

  const sourceOutcomes = orderedSources.map((source) => outcomes.get(source.productCode)!);
  const driveOnlyAssets = orderedImages
    .filter((image) => !claimedFileIds.has(image.fileId))
    .map((image) => ({
      fileId: image.fileId,
      filename: image.filename,
      folderId: image.folderId,
      folderName: image.folderName,
      normalizedStem: image.normalizedStem,
      status: "DRIVE_ONLY" as const,
      reason: "Drive image has no defensible SARIMA source association."
    }));

  return { sourceOutcomes, driveOnlyAssets };
}
