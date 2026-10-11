import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { HttpError } from "../../utils/httpError.js";

const CANDIDATE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const ORIGINAL_EXTENSIONS = new Set([".jpg", ".png", ".webp"]);
const PRODUCT_VARIANT_FILE_NAMES = {
  card: "card.webp",
  pdp: "pdp.webp",
  processed: "processed.webp"
} as const;
const CATEGORY_VARIANT_FILE_NAMES = {
  cover: "cover.webp",
  processed: "processed.webp",
  thumbnail: "thumbnail.webp"
} as const;

export type CatalogImageVariant = keyof typeof PRODUCT_VARIANT_FILE_NAMES;
export type CategoryImageVariant = keyof typeof CATEGORY_VARIANT_FILE_NAMES;

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
    return this.writeScopedOriginal("candidates", candidateId, extension, buffer);
  }

  public async writeCategoryOriginal(candidateId: string, extension: string, buffer: Buffer) {
    return this.writeScopedOriginal("category-candidates", candidateId, extension, buffer);
  }

  public async prepareCandidateOutputDirectory(candidateId: string) {
    return this.prepareScopedOutputDirectory("candidates", candidateId);
  }

  public async prepareCategoryCandidateOutputDirectory(candidateId: string) {
    return this.prepareScopedOutputDirectory("category-candidates", candidateId);
  }

  public variantStorageKey(candidateId: string, variant: CatalogImageVariant) {
    return this.scopedVariantStorageKey(
      "candidates",
      candidateId,
      PRODUCT_VARIANT_FILE_NAMES,
      variant
    );
  }

  public categoryVariantStorageKey(candidateId: string, variant: CategoryImageVariant) {
    return this.scopedVariantStorageKey(
      "category-candidates",
      candidateId,
      CATEGORY_VARIANT_FILE_NAMES,
      variant
    );
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
        const buffer = await readFile(fallbackPath);
        await this.promoteFallbackAsset(canonicalPath, buffer);
        return buffer;
      } catch (error) {
        if (error instanceof HttpError) throw error;
      }
    }

    throw new HttpError(404, "Catalog image asset was not found.", {
      code: "PRODUCT_IMAGE_ASSET_NOT_FOUND"
    });
  }

  public async removeCandidate(candidateId: string) {
    return this.removeScopedCandidate("candidates", candidateId);
  }

  public async removeCategoryCandidate(candidateId: string) {
    return this.removeScopedCandidate("category-candidates", candidateId);
  }

  private async writeScopedOriginal(
    scope: "candidates" | "category-candidates",
    candidateId: string,
    extension: string,
    buffer: Buffer
  ) {
    this.assertCandidateId(candidateId);
    if (!ORIGINAL_EXTENSIONS.has(extension)) {
      throw this.invalidStorageKeyError();
    }

    const key = `${scope}/${candidateId}/original${extension}`;
    const destination = this.resolveStorageKey(key);

    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, buffer, { flag: "wx" });

    return key;
  }

  private async prepareScopedOutputDirectory(
    scope: "candidates" | "category-candidates",
    candidateId: string
  ) {
    this.assertCandidateId(candidateId);
    const directory = this.resolveStorageKey(`${scope}/${candidateId}/processed`);
    await mkdir(directory, { recursive: true });
    return directory;
  }

  private scopedVariantStorageKey<TVariant extends string>(
    scope: "candidates" | "category-candidates",
    candidateId: string,
    variants: Readonly<Record<TVariant, string>>,
    variant: TVariant
  ) {
    this.assertCandidateId(candidateId);
    const fileName = variants[variant];
    if (!fileName) {
      throw this.invalidStorageKeyError();
    }
    return `${scope}/${candidateId}/processed/${fileName}`;
  }

  private async removeScopedCandidate(
    scope: "candidates" | "category-candidates",
    candidateId: string
  ) {
    this.assertCandidateId(candidateId);
    const key = `${scope}/${candidateId}`;
    const candidateDirectories = [this.root, ...this.fallbackRoots].map((storageRoot) =>
      this.resolveStorageKeyAgainstRoot(storageRoot, key)
    );

    await Promise.all(
      candidateDirectories.map((candidateDirectory) =>
        rm(candidateDirectory, { force: true, recursive: true })
      )
    );
  }

  private async promoteFallbackAsset(canonicalPath: string, buffer: Buffer) {
    try {
      await mkdir(path.dirname(canonicalPath), { recursive: true });
      await writeFile(canonicalPath, buffer, { flag: "wx" });
    } catch {
      // Recovery must still serve a valid fallback image if best-effort migration cannot write.
    }
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
