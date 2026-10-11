import multer from "multer";

import {
  CATEGORY_COVER_UPLOAD_LIMITS,
  PRODUCT_IMAGE_UPLOAD_LIMITS
} from "../security/security.constants.js";

const PRODUCT_IMPORT_FILE_SIZE_BYTES = 100 * 1024 * 1024;

const memoryStorage = multer.memoryStorage();

export const productImportUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: PRODUCT_IMPORT_FILE_SIZE_BYTES,
    files: 1
  }
});

export const productImageUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: PRODUCT_IMAGE_UPLOAD_LIMITS.maxFileBytes,
    files: 1
  }
});

export const categoryCoverUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: CATEGORY_COVER_UPLOAD_LIMITS.maxFileBytes,
    files: 1
  }
});

export const productImportFileSizeLimitBytes = PRODUCT_IMPORT_FILE_SIZE_BYTES;
