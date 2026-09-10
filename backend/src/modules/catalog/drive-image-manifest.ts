import path from "node:path";

import { normalizeSarimaSourceName } from "./sarima-source-manifest.js";

const EXPECTED_PHASE9_DRIVE_IMAGE_COUNT = 430;

export type DriveImageMetadata = {
  fileId: string;
  filename: string;
  folderId: string;
  folderName: string;
  mimeType: string;
};

export type DriveImageAsset = DriveImageMetadata & {
  extension: string;
  normalizedStem: string;
};

export function normalizeDriveImageStem(filename: string) {
  const trimmed = filename.trim();
  const extension = path.extname(trimmed);
  const stem = extension ? trimmed.slice(0, -extension.length) : trimmed;

  return normalizeSarimaSourceName(stem);
}

export function assertExpectedDriveImageCount(input: { length: number }) {
  if (input.length !== EXPECTED_PHASE9_DRIVE_IMAGE_COUNT) {
    throw new Error(`Expected exactly 430 unique raw Drive images; received ${input.length}.`);
  }
}

export function buildDriveImageManifest(items: DriveImageMetadata[]): DriveImageAsset[] {
  const seenFileIds = new Set<string>();

  const manifest = items.map((item) => {
    if (seenFileIds.has(item.fileId)) {
      throw new Error(`Drive image metadata contains duplicate file ID ${item.fileId}.`);
    }
    seenFileIds.add(item.fileId);

    if (!item.mimeType.startsWith("image/")) {
      throw new Error(`Expected image metadata for ${item.fileId}; received ${item.mimeType}.`);
    }

    return {
      extension: path.extname(item.filename).toLocaleLowerCase("en"),
      fileId: item.fileId,
      filename: item.filename,
      folderId: item.folderId,
      folderName: item.folderName,
      mimeType: item.mimeType,
      normalizedStem: normalizeDriveImageStem(item.filename)
    };
  });

  return manifest.sort(
    (left, right) =>
      left.folderName.localeCompare(right.folderName) ||
      left.filename.localeCompare(right.filename) ||
      left.fileId.localeCompare(right.fileId)
  );
}
