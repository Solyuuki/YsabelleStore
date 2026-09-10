import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { prisma } from "../database/prismaClient.js";
import { HttpError } from "../utils/httpError.js";
import { inspectProductImageUpload } from "../modules/catalog-image/imageUploadPolicy.js";
import { runCatalogImageEngine } from "../modules/catalog-image/catalogImageEngineRunner.js";
import {
  approveProductImageCandidate,
  createProductImageCandidate
} from "../modules/catalog-image/productImageService.js";
import {
  importProductsFromFile,
  previewProductImport,
  type ProductImportPreview,
  type ProductImportSummary
} from "./productImportService.js";

export const PRODUCT_PACKAGE_UPLOAD_LIMIT_BYTES = 100 * 1024 * 1024;
const PRODUCT_PACKAGE_EXTRACTED_LIMIT_BYTES = 250 * 1024 * 1024;
const PRODUCT_PACKAGE_MAX_FILES = 5_000;
const PRODUCT_PACKAGE_MAX_IMAGES = 1_000;
const PRODUCT_PACKAGE_MAX_DATA_FILES = 1;
const COMMAND_TIMEOUT_MS = 120_000;
const MAX_COMMAND_OUTPUT_BYTES = 4 * 1024 * 1024;

const DATA_EXTENSIONS = new Set([".csv", ".xlsx"]);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const BLOCKED_EXTENSIONS = new Set([
  ".bat",
  ".cmd",
  ".com",
  ".dll",
  ".exe",
  ".hta",
  ".jar",
  ".js",
  ".jse",
  ".lnk",
  ".msi",
  ".ps1",
  ".scr",
  ".sh",
  ".vbs",
  ".vbe",
  ".wsf"
]);
const ARCHIVE_SUFFIXES = [
  ".tar.bz2",
  ".tar.gz",
  ".tar.xz",
  ".tgz",
  ".zip",
  ".rar",
  ".7z",
  ".tar"
] as const;

export type ProductPackageArchiveType =
  | "zip"
  | "rar"
  | "7z"
  | "tar"
  | "tar.gz"
  | "tgz"
  | "tar.bz2"
  | "tar.xz";

export type ProductPackageSourceType = "ARCHIVE" | "GOOGLE_DRIVE";

export type ProductPackageMetadata = {
  sourceType: ProductPackageSourceType;
  packageFileName: string;
  archiveType: ProductPackageArchiveType;
  extractionEngine: string;
  filesScanned: number;
  foldersScanned: number;
  dataFileName: string;
  imagesFound: number;
  imagesMatched: number;
  imagesApproved: number;
  unmatchedImages: number;
  ignoredFiles: number;
  stagesCompleted: string[];
};

export type ProductPackagePreview = ProductImportPreview & {
  package: ProductPackageMetadata;
};

export type ProductPackageSummary = ProductImportSummary & {
  package: ProductPackageMetadata;
  imagesImported: number;
};

type UploadFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

type ExtractedFile = {
  absolutePath: string;
  relativePath: string;
  size: number;
};

type PreparedPackage = {
  cleanup: () => Promise<void>;
  dataFile: UploadFile;
  files: ExtractedFile[];
  images: ExtractedFile[];
  metadata: ProductPackageMetadata;
  root: string;
};

type ImageMatch = {
  image: ExtractedFile;
  rowNumber: number;
  sku: string;
};

type PackageIssue = ProductImportPreview["errors"][number];

function archiveSuffix(fileName: string) {
  const lower = fileName.trim().toLowerCase();
  return ARCHIVE_SUFFIXES.find((suffix) => lower.endsWith(suffix)) ?? null;
}

function archiveType(fileName: string): ProductPackageArchiveType {
  const suffix = archiveSuffix(fileName);
  if (!suffix) {
    throw new HttpError(415, "Unsupported product package type.", {
      code: "UNSUPPORTED_PRODUCT_PACKAGE_TYPE",
      details: { supportedExtensions: [...ARCHIVE_SUFFIXES] }
    });
  }
  return suffix.slice(1) as ProductPackageArchiveType;
}

function normalizeIdentity(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "");
}

function isArchivePath(fileName: string) {
  return archiveSuffix(fileName) !== null;
}

function assertSafeRelativeEntry(entry: string) {
  const normalized = entry.replace(/\\/g, "/");
  if (
    normalized.startsWith("/") ||
    /^[a-zA-Z]:/.test(normalized) ||
    normalized.split("/").some((segment) => segment === "..")
  ) {
    throw new HttpError(422, "Product package contains an unsafe path.", {
      code: "PRODUCT_PACKAGE_UNSAFE_PATH",
      details: { entry }
    });
  }
}

async function runCommand(command: string, args: string[], options: { cwd?: string } = {}) {
  return await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    let settled = false;

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      if (!settled) {
        settled = true;
        reject(
          new HttpError(504, "Product package extraction timed out.", {
            code: "PRODUCT_PACKAGE_EXTRACTION_TIMEOUT"
          })
        );
      }
    }, COMMAND_TIMEOUT_MS);

    const append = (target: "stdout" | "stderr", chunk: Buffer | string) => {
      const text = String(chunk);
      outputBytes += Buffer.byteLength(text, "utf8");
      if (outputBytes > MAX_COMMAND_OUTPUT_BYTES) {
        child.kill("SIGTERM");
        return;
      }
      if (target === "stdout") stdout += text;
      else stderr += text;
    };

    child.stdout.on("data", (chunk) => append("stdout", chunk));
    child.stderr.on("data", (chunk) => append("stderr", chunk));
    child.on("error", (error: NodeJS.ErrnoException) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      if (error.code === "ENOENT") {
        reject(error);
        return;
      }
      reject(
        new HttpError(503, "Product package extractor could not be started.", {
          code: "PRODUCT_PACKAGE_EXTRACTOR_UNAVAILABLE"
        })
      );
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      if (outputBytes > MAX_COMMAND_OUTPUT_BYTES) {
        reject(
          new HttpError(422, "Product package listing exceeded the safe output limit.", {
            code: "PRODUCT_PACKAGE_LISTING_TOO_LARGE"
          })
        );
        return;
      }
      if (code !== 0) {
        reject(
          new HttpError(422, "Product package could not be extracted.", {
            code: "PRODUCT_PACKAGE_EXTRACTION_FAILED",
            details: { stderr: stderr.trim().slice(0, 500) }
          })
        );
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

const PYTHON_ARCHIVE_SCRIPT = String.raw`
import os, re, stat, sys, tarfile, zipfile
archive, output, kind = sys.argv[1], sys.argv[2], sys.argv[3]
MAX_FILES = 5000
MAX_BYTES = 250 * 1024 * 1024
count = 0
total = 0

def safe_name(name):
    name = name.replace('\\', '/')
    if name.startswith('/') or re.match(r'^[A-Za-z]:', name):
        raise ValueError('unsafe path')
    parts = [p for p in name.split('/') if p not in ('', '.')]
    if '..' in parts:
        raise ValueError('unsafe path')
    return '/'.join(parts)

def target_for(name):
    safe = safe_name(name)
    target = os.path.realpath(os.path.join(output, safe))
    root = os.path.realpath(output) + os.sep
    if not (target + os.sep).startswith(root) and target != os.path.realpath(output):
        raise ValueError('unsafe path')
    return target

os.makedirs(output, exist_ok=True)
if kind == 'zip':
    with zipfile.ZipFile(archive) as z:
        infos = z.infolist()
        if len(infos) > MAX_FILES:
            raise ValueError('too many files')
        for info in infos:
            name = safe_name(info.filename)
            if not name:
                continue
            mode = (info.external_attr >> 16) & 0xFFFF
            if stat.S_ISLNK(mode):
                raise ValueError('links are not allowed')
            if info.is_dir():
                os.makedirs(target_for(name), exist_ok=True)
                continue
            count += 1
            total += info.file_size
            if count > MAX_FILES or total > MAX_BYTES:
                raise ValueError('archive exceeds safe extraction limits')
            target = target_for(name)
            os.makedirs(os.path.dirname(target), exist_ok=True)
            with z.open(info) as source, open(target, 'wb') as dest:
                while True:
                    chunk = source.read(1024 * 1024)
                    if not chunk: break
                    dest.write(chunk)
else:
    with tarfile.open(archive, 'r:*') as t:
        members = t.getmembers()
        if len(members) > MAX_FILES:
            raise ValueError('too many files')
        for member in members:
            name = safe_name(member.name)
            if not name:
                continue
            if member.issym() or member.islnk() or member.isdev():
                raise ValueError('links/devices are not allowed')
            if member.isdir():
                os.makedirs(target_for(name), exist_ok=True)
                continue
            if not member.isfile():
                continue
            count += 1
            total += member.size
            if count > MAX_FILES or total > MAX_BYTES:
                raise ValueError('archive exceeds safe extraction limits')
            source = t.extractfile(member)
            if source is None:
                raise ValueError('unable to read archive entry')
            target = target_for(name)
            os.makedirs(os.path.dirname(target), exist_ok=True)
            with source, open(target, 'wb') as dest:
                while True:
                    chunk = source.read(1024 * 1024)
                    if not chunk: break
                    dest.write(chunk)
print(f'{count}:{total}')
`;

function findSevenZipExecutable() {
  const candidates = [
    process.platform === "win32" ? "7z.exe" : "7z",
    process.platform === "win32" ? "7zz.exe" : "7zz",
    process.platform === "win32" ? "7za.exe" : "7za",
    ...(process.platform === "win32"
      ? ["C:\\Program Files\\7-Zip\\7z.exe", "C:\\Program Files (x86)\\7-Zip\\7z.exe"]
      : [])
  ];

  return candidates;
}

async function extractWithSevenZip(archivePath: string, output: string) {
  let lastMissing: unknown = null;
  for (const executable of findSevenZipExecutable()) {
    if (executable.includes(path.sep) && !existsSync(executable)) continue;
    try {
      const listing = await runCommand(executable, ["l", "-slt", archivePath]);
      const lines = listing.stdout.split(/\r?\n/);
      let inEntries = false;
      for (const line of lines) {
        if (line.startsWith("----------")) {
          inEntries = true;
          continue;
        }
        if (!inEntries) continue;
        if (line.startsWith("Encrypted = +")) {
          throw new HttpError(422, "Encrypted product packages are not supported.", {
            code: "PRODUCT_PACKAGE_ENCRYPTED"
          });
        }
        if (line.startsWith("Path = ")) {
          const entry = line.slice(7).trim();
          if (entry) assertSafeRelativeEntry(entry);
        }
      }
      await runCommand(executable, ["x", "-y", `-o${output}`, archivePath]);
      return path.basename(executable);
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
        lastMissing = error;
        continue;
      }
      throw error;
    }
  }

  void lastMissing;
  throw new HttpError(503, "RAR/7Z extraction requires 7-Zip on this server.", {
    code: "PRODUCT_PACKAGE_EXTRACTOR_UNAVAILABLE",
    details: { requiredEngine: "7-Zip" }
  });
}

async function extractArchive(
  archivePath: string,
  output: string,
  type: ProductPackageArchiveType
) {
  await mkdir(output, { recursive: true });
  if (type === "rar" || type === "7z") {
    return extractWithSevenZip(archivePath, output);
  }

  const python =
    process.env.PYTHON_EXECUTABLE?.trim() || (process.platform === "win32" ? "python" : "python3");
  const pythonKind = type === "zip" ? "zip" : "tar";
  try {
    await runCommand(python, ["-c", PYTHON_ARCHIVE_SCRIPT, archivePath, output, pythonKind]);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      throw new HttpError(503, "The product package extractor is unavailable.", {
        code: "PRODUCT_PACKAGE_EXTRACTOR_UNAVAILABLE",
        details: { requiredEngine: "Python" }
      });
    }
    throw error;
  }
  return "Python stdlib";
}

async function walkExtracted(root: string) {
  const files: ExtractedFile[] = [];
  let folders = 0;
  let totalBytes = 0;

  async function walk(directory: string) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(root, absolutePath);
      assertSafeRelativeEntry(relativePath);

      const stats = await lstat(absolutePath);
      if (stats.isSymbolicLink()) {
        throw new HttpError(422, "Product packages cannot contain symbolic links.", {
          code: "PRODUCT_PACKAGE_LINK_NOT_ALLOWED",
          details: { path: relativePath }
        });
      }
      if (stats.isDirectory()) {
        folders += 1;
        await walk(absolutePath);
        continue;
      }
      if (!stats.isFile()) continue;

      totalBytes += stats.size;
      files.push({
        absolutePath,
        relativePath: relativePath.replace(/\\/g, "/"),
        size: stats.size
      });
      if (files.length > PRODUCT_PACKAGE_MAX_FILES) {
        throw new HttpError(422, "Product package contains too many files.", {
          code: "PRODUCT_PACKAGE_TOO_MANY_FILES",
          details: { maxFiles: PRODUCT_PACKAGE_MAX_FILES }
        });
      }
      if (totalBytes > PRODUCT_PACKAGE_EXTRACTED_LIMIT_BYTES) {
        throw new HttpError(413, "Extracted product package exceeds the safe size limit.", {
          code: "PRODUCT_PACKAGE_EXTRACTED_TOO_LARGE",
          details: { maxBytes: PRODUCT_PACKAGE_EXTRACTED_LIMIT_BYTES }
        });
      }
    }
  }

  await walk(root);
  return { files, folders };
}

function mimeTypeForDataFile(fileName: string) {
  return fileName.toLowerCase().endsWith(".xlsx")
    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "text/csv";
}

function mimeTypeForImage(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  return "image/jpeg";
}

async function preparePackage(
  file: UploadFile,
  sourceType: ProductPackageSourceType
): Promise<PreparedPackage> {
  if (!file.originalname.trim()) {
    throw new HttpError(400, "Product package file name is invalid.", {
      code: "PRODUCT_PACKAGE_NAME_INVALID"
    });
  }
  if (file.buffer.length === 0) {
    throw new HttpError(400, "Product package is empty.", { code: "PRODUCT_PACKAGE_EMPTY" });
  }
  if (file.buffer.length > PRODUCT_PACKAGE_UPLOAD_LIMIT_BYTES) {
    throw new HttpError(413, "Product package exceeds the upload size limit.", {
      code: "PRODUCT_PACKAGE_TOO_LARGE",
      details: { maxBytes: PRODUCT_PACKAGE_UPLOAD_LIMIT_BYTES }
    });
  }

  const type = archiveType(file.originalname);
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "ysabelle-product-package-"));
  const sourcePath = path.join(tempRoot, `source${archiveSuffix(file.originalname) ?? ".pkg"}`);
  const extractionRoot = path.join(tempRoot, "contents");

  const cleanup = async () => {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  };

  try {
    await writeFile(sourcePath, file.buffer, { flag: "wx" });
    const extractionEngine = await extractArchive(sourcePath, extractionRoot, type);
    const scanned = await walkExtracted(extractionRoot);

    for (const extracted of scanned.files) {
      const extension = path.extname(extracted.relativePath).toLowerCase();
      if (BLOCKED_EXTENSIONS.has(extension)) {
        throw new HttpError(422, "Product package contains a blocked executable or script file.", {
          code: "PRODUCT_PACKAGE_BLOCKED_FILE",
          details: { path: extracted.relativePath }
        });
      }
      if (isArchivePath(extracted.relativePath)) {
        throw new HttpError(422, "Nested archives are not supported in product packages.", {
          code: "PRODUCT_PACKAGE_NESTED_ARCHIVE",
          details: { path: extracted.relativePath }
        });
      }
    }

    const dataFiles = scanned.files.filter((candidate) =>
      DATA_EXTENSIONS.has(path.extname(candidate.relativePath).toLowerCase())
    );
    if (dataFiles.length === 0) {
      throw new HttpError(
        422,
        "Product package does not contain a CSV or XLSX product data file.",
        {
          code: "PRODUCT_PACKAGE_DATA_FILE_MISSING"
        }
      );
    }
    if (dataFiles.length > PRODUCT_PACKAGE_MAX_DATA_FILES) {
      throw new HttpError(422, "Product package must contain exactly one product data file.", {
        code: "PRODUCT_PACKAGE_MULTIPLE_DATA_FILES",
        details: { files: dataFiles.map((entry) => entry.relativePath) }
      });
    }

    const images = scanned.files.filter((candidate) =>
      IMAGE_EXTENSIONS.has(path.extname(candidate.relativePath).toLowerCase())
    );
    if (images.length > PRODUCT_PACKAGE_MAX_IMAGES) {
      throw new HttpError(422, "Product package contains too many product images.", {
        code: "PRODUCT_PACKAGE_TOO_MANY_IMAGES",
        details: { maxImages: PRODUCT_PACKAGE_MAX_IMAGES }
      });
    }

    const dataFileEntry = dataFiles[0]!;
    const dataBuffer = await readFile(dataFileEntry.absolutePath);
    const ignoredFiles = scanned.files.length - dataFiles.length - images.length;

    return {
      cleanup,
      dataFile: {
        originalname: path.basename(dataFileEntry.relativePath),
        mimetype: mimeTypeForDataFile(dataFileEntry.relativePath),
        buffer: dataBuffer
      },
      files: scanned.files,
      images,
      root: extractionRoot,
      metadata: {
        sourceType,
        packageFileName: file.originalname,
        archiveType: type,
        extractionEngine,
        filesScanned: scanned.files.length,
        foldersScanned: scanned.folders,
        dataFileName: dataFileEntry.relativePath,
        imagesFound: images.length,
        imagesMatched: 0,
        imagesApproved: 0,
        unmatchedImages: images.length,
        ignoredFiles,
        stagesCompleted: ["archive-verified", "files-scanned", "data-file-detected"]
      }
    };
  } catch (error) {
    await cleanup();
    throw error;
  }
}

function matchImages(preview: ProductImportPreview, images: ExtractedFile[]) {
  const matches: ImageMatch[] = [];
  const errors: PackageIssue[] = [];
  const warnings: PackageIssue[] = [];
  const usedImages = new Set<string>();

  for (const row of preview.rows) {
    if (!row.normalizedData) continue;
    const skuKey = normalizeIdentity(row.normalizedData.sku);
    const nameKey = normalizeIdentity(row.normalizedData.name);
    const candidates = images.filter((image) => {
      const stemKey = normalizeIdentity(path.basename(image.relativePath));
      return stemKey === skuKey || stemKey === nameKey;
    });

    if (candidates.length > 1) {
      row.errors.push({
        code: "PRODUCT_PACKAGE_AMBIGUOUS_IMAGE",
        field: "image",
        message:
          "More than one package image matches this product. Keep one image named after the SKU or product name.",
        rowNumber: row.rowNumber,
        value: candidates.map((candidate) => candidate.relativePath).join(", ")
      });
      continue;
    }
    if (candidates.length === 0) {
      row.warnings.push({
        code: "PRODUCT_PACKAGE_IMAGE_NOT_FOUND",
        field: "image",
        message:
          "No package image matched this product. The product can still be reviewed without an image.",
        rowNumber: row.rowNumber,
        value: row.normalizedData.sku
      });
      continue;
    }

    const image = candidates[0]!;
    usedImages.add(image.relativePath);
    matches.push({ image, rowNumber: row.rowNumber, sku: row.normalizedData.sku });
  }

  for (const image of images) {
    if (!usedImages.has(image.relativePath)) {
      warnings.push({
        code: "PRODUCT_PACKAGE_UNMATCHED_IMAGE",
        field: "image",
        message: "An image was found but did not match any product SKU or product name.",
        value: image.relativePath
      });
    }
  }

  return { matches, errors, warnings, usedImages };
}

async function validateMatchedImages(
  preview: ProductImportPreview,
  matches: ImageMatch[],
  root: string
) {
  let approved = 0;

  for (const match of matches) {
    const row = preview.rows.find((candidate) => candidate.rowNumber === match.rowNumber);
    if (!row) continue;
    const buffer = await readFile(match.image.absolutePath);
    try {
      inspectProductImageUpload({
        buffer,
        mimetype: mimeTypeForImage(match.image.relativePath),
        originalname: path.basename(match.image.relativePath),
        size: match.image.size
      });
      const outputDirectory = path.join(root, ".validation", randomUUID());
      await mkdir(outputDirectory, { recursive: true });
      const result = await runCatalogImageEngine(match.image.absolutePath, outputDirectory);
      if (result.status !== "APPROVED" || !result.variants) {
        row.errors.push({
          code: "PRODUCT_PACKAGE_IMAGE_QUALITY_FAILED",
          field: "image",
          message: "Matched product image did not pass the catalog image quality gate.",
          rowNumber: row.rowNumber,
          value: match.image.relativePath
        });
      } else {
        approved += 1;
      }
    } catch (error) {
      row.errors.push({
        code: "PRODUCT_PACKAGE_IMAGE_INVALID",
        field: "image",
        message:
          error instanceof Error ? error.message : "Matched product image could not be validated.",
        rowNumber: row.rowNumber,
        value: match.image.relativePath
      });
    }
  }

  for (const row of preview.rows) {
    row.valid = Boolean(row.normalizedData) && row.errors.length === 0;
  }
  preview.validRows = preview.rows.filter((row) => row.valid).length;
  preview.invalidRows = preview.rows.length - preview.validRows;
  preview.errors = [...preview.errors, ...preview.rows.flatMap((row) => row.errors)].filter(
    (issue, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.code === issue.code &&
          candidate.rowNumber === issue.rowNumber &&
          candidate.field === issue.field &&
          candidate.value === issue.value
      ) === index
  );
  preview.warnings = [...preview.warnings, ...preview.rows.flatMap((row) => row.warnings)].filter(
    (issue, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.code === issue.code &&
          candidate.rowNumber === issue.rowNumber &&
          candidate.field === issue.field &&
          candidate.value === issue.value
      ) === index
  );

  return approved;
}

async function buildPackagePreview(prepared: PreparedPackage): Promise<{
  preview: ProductPackagePreview;
  matches: ImageMatch[];
}> {
  const spreadsheetPreview = await previewProductImport(prepared.dataFile);
  const matching = matchImages(spreadsheetPreview, prepared.images);
  spreadsheetPreview.errors.push(...matching.errors);
  spreadsheetPreview.warnings.push(...matching.warnings);
  const imagesApproved = await validateMatchedImages(
    spreadsheetPreview,
    matching.matches,
    prepared.root
  );

  const metadata: ProductPackageMetadata = {
    ...prepared.metadata,
    imagesMatched: matching.matches.length,
    imagesApproved,
    unmatchedImages: prepared.images.length - matching.usedImages.size,
    stagesCompleted: [
      ...prepared.metadata.stagesCompleted,
      "product-data-validated",
      "images-matched",
      "image-quality-validated",
      "preview-ready"
    ]
  };

  return {
    matches: matching.matches,
    preview: {
      ...spreadsheetPreview,
      fileName: prepared.metadata.packageFileName,
      package: metadata
    }
  };
}

export async function previewProductPackage(
  file: UploadFile,
  sourceType: ProductPackageSourceType = "ARCHIVE"
): Promise<ProductPackagePreview> {
  const prepared = await preparePackage(file, sourceType);
  try {
    const { preview } = await buildPackagePreview(prepared);
    return preview;
  } finally {
    await prepared.cleanup();
  }
}

export async function importProductPackage(
  file: UploadFile,
  performedById?: string,
  sourceType: ProductPackageSourceType = "ARCHIVE"
): Promise<ProductPackageSummary> {
  const prepared = await preparePackage(file, sourceType);
  try {
    const { preview, matches } = await buildPackagePreview(prepared);
    if (preview.invalidRows > 0 || preview.errors.length > 0) {
      throw new HttpError(422, "Product package contains validation errors and was rejected.", {
        code: "PRODUCT_PACKAGE_INVALID",
        details: preview
      });
    }

    const summary = await importProductsFromFile(prepared.dataFile, performedById);
    const skus = matches.map((match) => match.sku);
    const products = skus.length
      ? await prisma.product.findMany({
          select: { id: true, sku: true },
          where: { sku: { in: skus } }
        })
      : [];
    const productBySku = new Map(products.map((product) => [product.sku, product.id]));
    let imagesImported = 0;

    for (const match of matches) {
      const productId = productBySku.get(match.sku);
      if (!productId) {
        throw new HttpError(500, "Imported product could not be linked to its validated image.", {
          code: "PRODUCT_PACKAGE_IMAGE_LINK_FAILED",
          details: { sku: match.sku }
        });
      }
      const buffer = await readFile(match.image.absolutePath);
      const candidate = await createProductImageCandidate(productId, {
        buffer,
        mimetype: mimeTypeForImage(match.image.relativePath),
        originalname: path.basename(match.image.relativePath),
        size: match.image.size
      });
      if (candidate.processingStatus !== "READY" || candidate.qualityStatus !== "APPROVED") {
        throw new HttpError(
          500,
          "A previously validated package image failed during final processing.",
          {
            code: "PRODUCT_PACKAGE_IMAGE_COMMIT_FAILED",
            details: { sku: match.sku }
          }
        );
      }
      await approveProductImageCandidate(productId, candidate.id);
      imagesImported += 1;
    }

    return {
      ...summary,
      fileName: preview.package.packageFileName,
      package: preview.package,
      imagesImported
    };
  } finally {
    await prepared.cleanup();
  }
}

function parseGoogleDriveFileId(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new HttpError(400, "Google Drive link is invalid.", {
      code: "GOOGLE_DRIVE_LINK_INVALID"
    });
  }
  if (url.protocol !== "https:" || !/(^|\.)drive\.google\.com$/i.test(url.hostname)) {
    throw new HttpError(400, "Use a Google Drive HTTPS file link.", {
      code: "GOOGLE_DRIVE_LINK_INVALID"
    });
  }
  const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
  const id = fileMatch?.[1] ?? url.searchParams.get("id");
  if (!id || !/^[A-Za-z0-9_-]{10,}$/.test(id)) {
    throw new HttpError(400, "Google Drive file id could not be resolved from the link.", {
      code: "GOOGLE_DRIVE_FILE_ID_INVALID"
    });
  }
  return id;
}

function fileNameFromContentDisposition(value: string | null) {
  if (!value) return null;
  const utf8 = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plain = value.match(/filename="?([^";]+)"?/i)?.[1];
  const raw = utf8 ?? plain;
  if (!raw) return null;
  try {
    return decodeURIComponent(raw).replace(/[\\/]/g, "_");
  } catch {
    return raw.replace(/[\\/]/g, "_");
  }
}

export async function downloadGoogleDriveProductPackage(link: string): Promise<UploadFile> {
  const id = parseGoogleDriveFileId(link);
  const downloadUrl = new URL("https://drive.usercontent.google.com/download");
  downloadUrl.searchParams.set("id", id);
  downloadUrl.searchParams.set("export", "download");
  downloadUrl.searchParams.set("confirm", "t");

  const response = await fetch(downloadUrl, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new HttpError(
      422,
      "Google Drive package could not be downloaded. Check sharing access.",
      {
        code: "GOOGLE_DRIVE_DOWNLOAD_FAILED",
        details: { status: response.status }
      }
    );
  }
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("text/html")) {
    throw new HttpError(422, "Google Drive returned a web page instead of a shared package file.", {
      code: "GOOGLE_DRIVE_FILE_NOT_PUBLIC"
    });
  }

  const chunks: Buffer[] = [];
  let total = 0;
  const reader = response.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > PRODUCT_PACKAGE_UPLOAD_LIMIT_BYTES) {
      await reader.cancel();
      throw new HttpError(413, "Google Drive product package exceeds the upload size limit.", {
        code: "PRODUCT_PACKAGE_TOO_LARGE",
        details: { maxBytes: PRODUCT_PACKAGE_UPLOAD_LIMIT_BYTES }
      });
    }
    chunks.push(Buffer.from(value));
  }

  let originalname = fileNameFromContentDisposition(response.headers.get("content-disposition"));
  if (!originalname || !archiveSuffix(originalname)) {
    const type = contentType.includes("zip") ? ".zip" : null;
    if (!type) {
      throw new HttpError(
        415,
        "Google Drive file name does not identify a supported archive type.",
        {
          code: "UNSUPPORTED_PRODUCT_PACKAGE_TYPE"
        }
      );
    }
    originalname = `google-drive-product-package${type}`;
  }

  return {
    originalname,
    mimetype: contentType || "application/octet-stream",
    buffer: Buffer.concat(chunks)
  };
}

export async function previewGoogleDriveProductPackage(link: string) {
  const file = await downloadGoogleDriveProductPackage(link);
  return previewProductPackage(file, "GOOGLE_DRIVE");
}

export async function importGoogleDriveProductPackage(link: string, performedById?: string) {
  const file = await downloadGoogleDriveProductPackage(link);
  return importProductPackage(file, performedById, "GOOGLE_DRIVE");
}
