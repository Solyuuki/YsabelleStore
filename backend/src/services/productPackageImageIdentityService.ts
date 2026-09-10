import path from "node:path";

import JSZip from "jszip";
import { createWorker } from "tesseract.js";

import { previewProductImport, type ProductImportPreview } from "./productImportService.js";

type UploadFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

type ProductCandidate = {
  rowNumber: number;
  name: string;
  sku: string;
  barcode: string | null;
};

type RankedCandidate = ProductCandidate & {
  score: number;
};

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const DATA_EXTENSIONS = new Set([".csv", ".xlsx"]);
const MIN_MATCH_SCORE = 36;
const MIN_MATCH_MARGIN = 12;
const SIGNIFICANT_TOKEN_MIN_LENGTH = 2;
const COMMON_WORDS = new Set([
  "the",
  "and",
  "with",
  "for",
  "in",
  "of",
  "a",
  "an",
  "product",
  "bottle",
  "pack",
  "piece",
  "pcs",
  "ml",
  "l",
  "g",
  "kg"
]);

function normalizeCompact(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeWords(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalizeWords(value)
    .split(/\s+/)
    .map((token) => token.replace(/^\.+|\.+$/g, ""))
    .filter(
      (token) =>
        token.length >= SIGNIFICANT_TOKEN_MIN_LENGTH &&
        !COMMON_WORDS.has(token) &&
        !/^\d+$/.test(token)
    );
}

function extractSizeTokens(value: string) {
  const compact = normalizeCompact(value);
  const matches = compact.match(/\d+(?:\d+)?(?:ml|l|g|kg)/g) ?? [];
  return [...new Set(matches)];
}

function basenameKey(fileName: string) {
  return normalizeCompact(path.basename(fileName, path.extname(fileName)));
}

function mimeTypeForDataFile(fileName: string) {
  return fileName.toLowerCase().endsWith(".xlsx")
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "text/csv";
}

function candidatesFromPreview(preview: ProductImportPreview): ProductCandidate[] {
  return preview.rows
    .filter((row) => Boolean(row.normalizedData))
    .map((row) => ({
      rowNumber: row.rowNumber,
      name: row.normalizedData!.name,
      sku: row.normalizedData!.sku,
      barcode: row.normalizedData!.barcode
    }));
}

function scoreCandidate(ocrText: string, candidate: ProductCandidate): number {
  const compactText = normalizeCompact(ocrText);
  if (!compactText) return 0;

  let score = 0;
  const skuKey = normalizeCompact(candidate.sku);
  const barcodeKey = candidate.barcode ? normalizeCompact(candidate.barcode) : "";

  if (barcodeKey && barcodeKey.length >= 6 && compactText.includes(barcodeKey)) {
    score += 120;
  }
  if (skuKey.length >= 4 && compactText.includes(skuKey)) {
    score += 100;
  }

  const ocrTokens = new Set(tokenize(ocrText));
  const nameTokens = [...new Set(tokenize(candidate.name))];
  const matchedNameTokens = nameTokens.filter((token) => ocrTokens.has(token));

  score += matchedNameTokens.length * 14;

  const nameSizeTokens = extractSizeTokens(candidate.name);
  const ocrSizeTokens = new Set(extractSizeTokens(ocrText));
  const matchedSizeTokens = nameSizeTokens.filter((token) => ocrSizeTokens.has(token));

  score += matchedSizeTokens.length * 30;

  const nameCompact = normalizeCompact(candidate.name);
  if (nameCompact.length >= 6 && compactText.includes(nameCompact)) {
    score += 70;
  }

  return score;
}

function resolveUniqueCandidate(ocrText: string, candidates: ProductCandidate[], claimedSkus: Set<string>) {
  const ranked: RankedCandidate[] = candidates
    .filter((candidate) => !claimedSkus.has(candidate.sku))
    .map((candidate) => ({ ...candidate, score: scoreCandidate(ocrText, candidate) }))
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  const second = ranked[1];
  if (!best || best.score < MIN_MATCH_SCORE) return null;
  if (second && best.score - second.score < MIN_MATCH_MARGIN) return null;
  return best;
}

function alreadyFilenameMatched(imagePath: string, candidates: ProductCandidate[]) {
  const stem = basenameKey(imagePath);
  return candidates.find(
    (candidate) =>
      stem === normalizeCompact(candidate.sku) || stem === normalizeCompact(candidate.name)
  );
}

/**
 * Enhances ZIP packages before the existing package-import pipeline runs.
 *
 * Existing deterministic SKU/product-name filenames remain untouched. For images with arbitrary
 * filenames, OCR is used only to identify which spreadsheet row the image most likely belongs to.
 * A match is accepted only when it clears a minimum score and confidence margin; ambiguous images
 * are intentionally left unchanged so the normal importer reports them as unmatched rather than
 * attaching them to the wrong product.
 *
 * CIQE remains the quality/normalization gate after association. This service only handles identity.
 */
export async function preparePackageImageIdentity(file: UploadFile): Promise<UploadFile> {
  if (!file.originalname.toLowerCase().endsWith(".zip")) {
    return file;
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file.buffer, { checkCRC32: true });
  } catch {
    return file;
  }

  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const dataEntries = entries.filter((entry) =>
    DATA_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
  );
  const imageEntries = entries.filter((entry) =>
    IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
  );

  // Let the existing package validator produce the canonical error for malformed packages.
  if (dataEntries.length !== 1 || imageEntries.length === 0) {
    return file;
  }

  const dataEntry = dataEntries[0]!;
  const dataBuffer = await dataEntry.async("nodebuffer");
  const preview = await previewProductImport({
    originalname: path.basename(dataEntry.name),
    mimetype: mimeTypeForDataFile(dataEntry.name),
    buffer: dataBuffer
  });
  const candidates = candidatesFromPreview(preview);

  if (candidates.length === 0) return file;

  const claimedSkus = new Set<string>();
  const arbitraryImages: typeof imageEntries = [];

  for (const image of imageEntries) {
    const matched = alreadyFilenameMatched(image.name, candidates);
    if (matched) claimedSkus.add(matched.sku);
    else arbitraryImages.push(image);
  }

  if (arbitraryImages.length === 0) return file;

  const worker = await createWorker("eng");
  let changed = false;

  try {
    for (const image of arbitraryImages) {
      const buffer = await image.async("nodebuffer");
      const recognition = await worker.recognize(buffer);
      const match = resolveUniqueCandidate(recognition.data.text ?? "", candidates, claimedSkus);
      if (!match) continue;

      const extension = path.extname(image.name).toLowerCase();
      const targetName = `images/${match.sku}${extension}`;
      if (zip.file(targetName)) continue;

      zip.file(targetName, buffer);
      zip.remove(image.name);
      claimedSkus.add(match.sku);
      changed = true;
    }
  } finally {
    await worker.terminate();
  }

  if (!changed) return file;

  return {
    ...file,
    buffer: await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 }
    })
  };
}
