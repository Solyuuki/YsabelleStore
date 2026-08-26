import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
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
  private readonly fallbackRoots: string[];

  public constructor(root: string, fallbackRoots: string[] = []) {
    this.root = path.resolve(root);
    this.fallbackRoots = Array.from(
      new Set(fallbackRoots.map((fallbackRoot) => path.resolve(fallbackRoot)))
    ).filter((fallbackRoot) => fallbackRoot !== this.root);
  }

  public resolveStorageKey(key: string) {
    return this.resolveStorageKeyAgainstRoot(this.root, key);
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

  public async readStorageKey(key: string) {
    const canonicalPath = this.resolveStorageKey(key);

    try {
      return await readFile(canonicalPath);
    } catch (error) {
      if (error instanceof HttpError) throw error;
    }

    for (const fallbackRoot of this.fallbackRoots) {
      const fallbackPath = this.resolveStorageKeyAgainstRoot(fallbackRoot, key);
      try {
        return await readFile(fallbackPath);
      } catch (error) {
        if (error instanceof HttpError) throw error;
      }
    }

    throw new HttpError(404, "Catalog image asset was not found.", {
      code: "PRODUCT_IMAGE_ASSET_NOT_FOUND"
    });
  }

  public async removeCandidate(candidateId: string) {
    this.assertCandidateId(candidateId);
    const key = `candidates/${candidateId}`;
    const candidateDirectories = [this.root, ...this.fallbackRoots].map((storageRoot) =>
      this.resolveStorageKeyAgainstRoot(storageRoot, key)
    );

    await Promise.all(
      candidateDirectories.map((candidateDirectory) =>
        rm(candidateDirectory, { force: true, recursive: true })
      )
    );
  }

  private resolveStorageKeyAgainstRoot(storageRoot: string, key: string) {
    const normalizedKey = key.replaceAll("\\", "/");
    const resolved = path.resolve(storageRoot, normalizedKey);
    const relative = path.relative(storageRoot, resolved);

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
