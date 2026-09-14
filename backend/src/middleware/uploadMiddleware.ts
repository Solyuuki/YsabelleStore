import multer from "multer";

import { PRODUCT_IMAGE_UPLOAD_LIMITS } from "../security/security.constants.js";
import { HttpError } from "../utils/httpError.js";

const PRODUCT_IMPORT_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const PRODUCT_PACKAGE_SUFFIXES = [
  ".tar.bz2",
  ".tar.gz",
  ".tar.xz",
  ".tgz",
  ".zip",
  ".rar",
  ".7z",
  ".tar"
] as const;

const memoryStorage = multer.memoryStorage();

export const productImportUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: PRODUCT_IMPORT_FILE_SIZE_BYTES,
    files: 1
  }
});

export const productPackageImportUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: PRODUCT_IMPORT_FILE_SIZE_BYTES,
    files: 1
  },
  fileFilter: (_request, file, callback) => {
    const fileName = file.originalname.trim().toLowerCase();
    const supported = PRODUCT_PACKAGE_SUFFIXES.some((suffix) => fileName.endsWith(suffix));

    if (!supported) {
      callback(
        new HttpError(415, "Unsupported product package type.", {
          code: "UNSUPPORTED_PRODUCT_PACKAGE_TYPE",
          details: { supportedExtensions: [...PRODUCT_PACKAGE_SUFFIXES] }
        })
      );
      return;
    }

    callback(null, true);
  }
});

export const productImageUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: PRODUCT_IMAGE_UPLOAD_LIMITS.maxFileBytes,
    files: 1
  }
});

export const productImportFileSizeLimitBytes = PRODUCT_IMPORT_FILE_SIZE_BYTES;
