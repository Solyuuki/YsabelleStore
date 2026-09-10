import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { DriveImageMetadata } from "./drive-image-manifest.js";

function isDriveImageMetadata(value: unknown): value is DriveImageMetadata {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;

  return (
    typeof entry.fileId === "string" &&
    entry.fileId.length > 0 &&
    typeof entry.filename === "string" &&
    entry.filename.length > 0 &&
    typeof entry.folderId === "string" &&
    entry.folderId.length > 0 &&
    typeof entry.folderName === "string" &&
    entry.folderName.length > 0 &&
    typeof entry.mimeType === "string" &&
    entry.mimeType.length > 0
  );
}

export async function loadDriveImageMetadataSnapshot(
  snapshotDir: string
): Promise<DriveImageMetadata[]> {
  const entries = await readdir(snapshotDir, { withFileTypes: true });
  const shardNames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (shardNames.length === 0) {
    throw new Error(`No Drive image metadata JSON shards found in ${snapshotDir}.`);
  }

  const metadata: DriveImageMetadata[] = [];

  for (const shardName of shardNames) {
    const shardPath = path.join(snapshotDir, shardName);
    const raw = await readFile(shardPath, "utf8");
    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`Invalid JSON in Drive image metadata shard ${shardName}.`, {
        cause: error
      });
    }

    if (!Array.isArray(parsed)) {
      throw new Error(`Drive image metadata shard ${shardName} must contain a JSON array.`);
    }

    parsed.forEach((entry, index) => {
      if (!isDriveImageMetadata(entry)) {
        throw new Error(
          `Invalid Drive image metadata at ${shardName}[${index}]; expected fileId, filename, folderId, folderName, and mimeType.`
        );
      }
      metadata.push(entry);
    });
  }

  return metadata;
}
