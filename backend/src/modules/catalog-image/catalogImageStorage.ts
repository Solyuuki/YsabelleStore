import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { HttpError } from "../../utils/httpError.js";

const CANDIDATE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const ORIGINAL_EXTENSIONS = new Set([".jpg", ".png", ".webp"]);
const VARIANT_FILE_NAMES = {
  card: "card.webp",
  pdp: "pdp.webp",
  processed: "processed.webp"
} as const;

export type CatalogImageVariant = keyof typeof VARIANT_FILE_NAMES;

export class CatalogImageStorage {
  private readonly root: string;

  public constructor(root: string) {
    this.root = path.resolve(root);
  }

  public resolveStorageKey(key: string) {
    const normalizedKey = key.replaceAll("\\", "/");
    const resolved = path.resolve(this.root, normalizedKey);
    const relative = path.relative(this.root, resolved);

    if (
      !normalizedKey ||
      path.isAbsolute(normalizedKey) ||
      relative === "" ||
      relative.startsWith(`..${path.sep}`) ||
      relative === ".." ||
      path.isAbsolute(relative)
    ) {
      throw new HttpError(400, "Catalog image storage key is invalid.", {
        code: "CATALOG_IMAGE_INVALID_STORAGE_KEY"
      });
    }

    return resolved;
  }

  public async writeOriginal(candidateId: string, extension: string, buffer: Buffer) {
    this.assertCandidateId(candidateId);
    if (!ORIGINAL_EXTENSIONS.has(extension)) {
      throw this.invalidStorageKeyError();
    }

    const key = `candidates/${candidateId}/original${extension}`;
    const destination = this.resolveStorageKey(key);

    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, buffer, { flag: "wx" });

    return key;
  }

  public async prepareCandidateOutputDirectory(candidateId: string) {
    this.assertCandidateId(candidateId);
    const directory = this.resolveStorageKey(`candidates/${candidateId}/processed`);
    await mkdir(directory, { recursive: true });
    return directory;
  }

  public variantStorageKey(candidateId: string, variant: CatalogImageVariant) {
    this.assertCandidateId(candidateId);
    const fileName = VARIANT_FILE_NAMES[variant];
    if (!fileName) {
      throw this.invalidStorageKeyError();
    }
    return `candidates/${candidateId}/processed/${fileName}`;
  }

  public async removeCandidate(candidateId: string) {
    this.assertCandidateId(candidateId);
    const candidateDirectory = this.resolveStorageKey(`candidates/${candidateId}`);
    await rm(candidateDirectory, { force: true, recursive: true });
  }

  private assertCandidateId(candidateId: string) {
    if (!CANDIDATE_ID_PATTERN.test(candidateId)) {
      throw this.invalidStorageKeyError();
    }
  }

  private invalidStorageKeyError() {
    return new HttpError(400, "Catalog image storage request is invalid.", {
      code: "CATALOG_IMAGE_INVALID_STORAGE_KEY"
    });
  }
}
