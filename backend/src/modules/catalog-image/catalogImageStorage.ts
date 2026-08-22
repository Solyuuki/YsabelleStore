import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { HttpError } from "../../utils/httpError.js";

const CANDIDATE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;
const ORIGINAL_EXTENSIONS = new Set([".jpg", ".png", ".webp"]);

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
    if (!CANDIDATE_ID_PATTERN.test(candidateId) || !ORIGINAL_EXTENSIONS.has(extension)) {
      throw new HttpError(400, "Catalog image storage request is invalid.", {
        code: "CATALOG_IMAGE_INVALID_STORAGE_KEY"
      });
    }

    const key = `candidates/${candidateId}/original${extension}`;
    const destination = this.resolveStorageKey(key);

    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, buffer, { flag: "wx" });

    return key;
  }

  public async removeCandidate(candidateId: string) {
    if (!CANDIDATE_ID_PATTERN.test(candidateId)) {
      throw new HttpError(400, "Catalog image storage request is invalid.", {
        code: "CATALOG_IMAGE_INVALID_STORAGE_KEY"
      });
    }

    const candidateDirectory = this.resolveStorageKey(`candidates/${candidateId}`);
    await rm(candidateDirectory, { force: true, recursive: true });
  }
}
