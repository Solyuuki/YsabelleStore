import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [
  productRoutes,
  storefrontRoutes,
  uploadMiddleware,
  controller,
  service,
  storage,
  runner,
  gitignore
] = await Promise.all([
  readFile(new URL("../backend/src/routes/product.routes.ts", import.meta.url), "utf8"),
  readFile(new URL("../backend/src/routes/storefront.routes.ts", import.meta.url), "utf8"),
  readFile(new URL("../backend/src/middleware/uploadMiddleware.ts", import.meta.url), "utf8"),
  readFile(
    new URL("../backend/src/controllers/productImageController.ts", import.meta.url),
    "utf8"
  ),
  readFile(
    new URL("../backend/src/modules/catalog-image/productImageService.ts", import.meta.url),
    "utf8"
  ),
  readFile(
    new URL("../backend/src/modules/catalog-image/catalogImageStorage.ts", import.meta.url),
    "utf8"
  ),
  readFile(
    new URL("../backend/src/modules/catalog-image/catalogImageEngineRunner.ts", import.meta.url),
    "utf8"
  ),
  readFile(new URL("../.gitignore", import.meta.url), "utf8")
]);

assert.match(uploadMiddleware, /export const productImageUpload = multer\(/);
assert.match(uploadMiddleware, /fileSize:\s*PRODUCT_IMAGE_UPLOAD_LIMITS\.maxFileBytes/);
assert.match(productRoutes, /"\/:id\/images"/);
assert.match(productRoutes, /requireRole\("OWNER"\)/);
assert.match(productRoutes, /productImageUpload\.single\("image"\)/);
assert.match(productRoutes, /uploadProductImageController/);
assert.match(productRoutes, /"\/:productId\/images\/:imageId\/approve"/);
assert.match(productRoutes, /"\/:productId\/images\/:imageId\/reject"/);
assert.match(productRoutes, /"\/:productId\/images\/:imageId\/preview\/:variant"/);
assert.match(storefrontRoutes, /"\/product-images\/:imageId\/:variant"/);
assert.match(controller, /createProductImageCandidate/);
assert.match(controller, /approveProductImageCandidate/);
assert.match(controller, /rejectProductImageCandidate/);
assert.match(controller, /PRODUCT_IMAGE_REQUIRED/);
assert.match(controller, /private, no-store/);
assert.match(controller, /public, max-age=31536000, immutable/);
assert.match(service, /export async function createProductImageCandidate/);
assert.match(service, /export async function processProductImageCandidate/);
assert.match(service, /export async function approveProductImageCandidate/);
assert.match(service, /export async function rejectProductImageCandidate/);
assert.match(service, /export async function getOwnerProductImageVariant/);
assert.match(service, /export async function getPublicProductImageVariant/);
assert.match(service, /inspectProductImageUpload/);
assert.match(service, /productImageAsset\.create/);
assert.match(service, /processingStatus:\s*"PROCESSING"/);
assert.match(service, /processingStatus:\s*"READY"/);
assert.match(service, /processingStatus:\s*"FAILED"/);
assert.match(service, /qualityStatus:\s*"NEEDS_REVIEW"/);
assert.match(service, /qualityStatus\s*!==\s*"APPROVED"/);
assert.match(service, /runCatalogImageEngine/);
assert.match(service, /variantStorageKey/);
assert.match(service, /\$transaction/);
assert.match(service, /activeImageAssetId:\s*candidate\.id/);
assert.match(service, /removeCandidate/);
assert.match(storage, /public async prepareCandidateOutputDirectory/);
assert.match(storage, /public variantStorageKey/);
assert.match(storage, /public async readStorageKey/);
assert.match(storage, /public async removeCandidate/);
assert.match(runner, /shell:\s*false/);
assert.match(runner, /CATALOG_IMAGE_PROCESS_TIMEOUT_MS/);
assert.match(runner, /MAX_PROCESS_OUTPUT_BYTES/);
assert.match(gitignore, /^\.data\/$/m);

console.log("catalog image upload, processing, approval, and delivery contract passed");
