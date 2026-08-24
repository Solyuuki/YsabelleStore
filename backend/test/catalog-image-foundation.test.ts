import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { prisma } from "../src/database/prismaClient.js";
import { CatalogImageStorage } from "../src/modules/catalog-image/catalogImageStorage.js";
import { inspectProductImageUpload } from "../src/modules/catalog-image/imageUploadPolicy.js";
import { captureDatabaseFixtureScope } from "./helpers/databaseFixtureScope.js";

test("product image upload trusts PNG magic bytes instead of filename or declared MIME", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const inspection = inspectProductImageUpload({
    buffer: png,
    mimetype: "image/jpeg",
    originalname: "fake.jpg",
    size: png.length
  });

  assert.equal(inspection.detectedMimeType, "image/png");
  assert.equal(inspection.extension, ".png");
});

test("product image upload detects JPEG and WebP from bytes", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43]);
  const webp = Buffer.concat([
    Buffer.from("RIFF", "ascii"),
    Buffer.alloc(4),
    Buffer.from("WEBP", "ascii"),
    Buffer.from("VP8 ", "ascii")
  ]);

  assert.deepEqual(
    inspectProductImageUpload({
      buffer: jpeg,
      mimetype: "application/octet-stream",
      originalname: "photo.bin",
      size: jpeg.length
    }),
    {
      detectedMimeType: "image/jpeg",
      extension: ".jpg"
    }
  );
  assert.deepEqual(
    inspectProductImageUpload({
      buffer: webp,
      mimetype: "image/png",
      originalname: "wrong.png",
      size: webp.length
    }),
    {
      detectedMimeType: "image/webp",
      extension: ".webp"
    }
  );
});

test("product image upload rejects unsupported bytes", () => {
  assert.throws(
    () =>
      inspectProductImageUpload({
        buffer: Buffer.from("<svg></svg>"),
        mimetype: "image/svg+xml",
        originalname: "x.svg",
        size: 11
      }),
    (error) =>
      error instanceof Error &&
      (error as { code?: string }).code === "PRODUCT_IMAGE_UNSUPPORTED_TYPE"
  );
});

test("product image upload rejects files over the hard byte limit", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  assert.throws(
    () =>
      inspectProductImageUpload({
        buffer: png,
        mimetype: "image/png",
        originalname: "large.png",
        size: 8 * 1024 * 1024 + 1
      }),
    (error) =>
      error instanceof Error && (error as { code?: string }).code === "PRODUCT_IMAGE_TOO_LARGE"
  );
});

test("catalog image storage uses generated keys and blocks path traversal", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "ysabelle-catalog-images-"));

  try {
    const storage = new CatalogImageStorage(temporaryRoot);
    const key = await storage.writeOriginal("candidate-1", ".png", Buffer.from("image-bytes"));

    assert.equal(key, "candidates/candidate-1/original.png");
    assert.equal(await readFile(storage.resolveStorageKey(key), "utf8"), "image-bytes");
    assert.throws(
      () => storage.resolveStorageKey("../../escape.webp"),
      (error) =>
        error instanceof Error &&
        (error as { code?: string }).code === "CATALOG_IMAGE_INVALID_STORAGE_KEY"
    );
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
});

test("product image candidate is persisted without replacing the active product image", async () => {
  const scope = await captureDatabaseFixtureScope(prisma);
  const suffix = randomUUID().slice(0, 8);

  try {
    const category = await prisma.category.create({
      data: {
        dataQualityStatus: "APPROVED",
        isActive: true,
        isStorefrontVisible: true,
        name: `Image Candidate ${suffix}`,
        recordSource: "CATALOG",
        slug: `image-candidate-${suffix}`
      }
    });
    const legacyImageUrl = `/images/products/existing-${suffix}.webp`;
    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        costPrice: "10",
        dataQualityStatus: "APPROVED",
        imageUrl: legacyImageUrl,
        isStorefrontVisible: true,
        name: `Candidate Product ${suffix}`,
        sellingPrice: "15",
        sku: `IMAGE-CANDIDATE-${suffix}`,
        status: "ACTIVE",
        unit: "PIECE"
      }
    });

    const candidate = await prisma.productImageAsset.create({
      data: {
        originalStorageKey: `candidates/${suffix}/original.png`,
        productId: product.id,
        sourceBytes: 1024,
        sourceMimeType: "image/png"
      }
    });
    const reloaded = await prisma.product.findUniqueOrThrow({ where: { id: product.id } });

    assert.equal(candidate.productId, product.id);
    assert.equal(candidate.qualityStatus, "NEEDS_REVIEW");
    assert.equal(candidate.processingStatus, "PENDING");
    assert.equal(reloaded.imageUrl, legacyImageUrl);
    assert.equal(reloaded.activeImageAssetId, null);
  } finally {
    await scope.cleanup();
  }
});
