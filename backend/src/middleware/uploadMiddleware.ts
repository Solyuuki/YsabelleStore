import multer from "multer";

const PRODUCT_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const memoryStorage = multer.memoryStorage();

export const productImportUpload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: PRODUCT_IMPORT_FILE_SIZE_BYTES,
    files: 1
  }
});

export const productImportFileSizeLimitBytes = PRODUCT_IMPORT_FILE_SIZE_BYTES;
