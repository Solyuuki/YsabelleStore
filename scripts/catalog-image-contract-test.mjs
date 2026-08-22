import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [routes, uploadMiddleware, controller, service, storage, gitignore] = await Promise.all([
  readFile(new URL("../backend/src/routes/product.routes.ts", import.meta.url), "utf8"),
  readFile(new URL("../backend/src/middleware/uploadMiddleware.ts", import.meta.url), "utf8"),
  readFile(new URL("../backend/src/controllers/productImageController.ts", import.meta.url), "utf8"),
  readFile(new URL("../backend/src/modules/catalog-image/productImageService.ts", import.meta.url), "utf8"),
  readFile(new URL("../backend/src/modules/catalog-image/catalogImageStorage.ts", import.meta.url), "utf8"),
  readFile(new URL("../.gitignore", import.meta.url), "utf8")
]);

assert.match(uploadMiddleware, /export const productImageUpload = multer\(/);
assert.match(uploadMiddleware, /fileSize:\s*PRODUCT_IMAGE_UPLOAD_LIMITS\.maxFileBytes/);
assert.match(routes, /"\/:id\/images"/);
assert.match(routes, /requireRole\("OWNER"\)/);
assert.match(routes, /productImageUpload\.single\("image"\)/);
assert.match(routes, /uploadProductImageController/);
assert.match(controller, /createProductImageCandidate/);
assert.match(controller, /PRODUCT_IMAGE_REQUIRED/);
assert.match(service, /export async function createProductImageCandidate/);
assert.match(service, /inspectProductImageUpload/);
assert.match(service, /productImageAsset\.create/);
assert.match(service, /removeCandidate/);
assert.match(storage, /public async removeCandidate/);
assert.match(gitignore, /^\.data\/$/m);

console.log("catalog image upload route contract passed");
