# Catalog Image Quality Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a server-side Catalog Image Quality Engine (CIQE) that lets an owner save a product independently, upload a real product image, receive deterministic quality analysis and safe normalization, preview the result, and publish only an approved processed image to the storefront.

**Architecture:** Keep the existing Node/TypeScript API as the orchestration and persistence layer. Reuse the repository's existing Python/Pillow image-processing direction and the existing Node-to-Python subprocess pattern used by forecasting for deterministic image analysis/normalization. Product image candidates are persisted separately from the active storefront image; processing a candidate never overwrites an active approved image, and approval is an explicit atomic promotion step.

**Tech Stack:** Node.js >=20.11, TypeScript 5.7, Express 4, Multer 2.2, Prisma 6/MySQL, Python 3 + Pillow, React 19, existing Tailwind/shadcn UI, Node test runner, Python unittest/pytest-compatible tests.

**Spec:** `docs/superpowers/specs/2026-08-22-catalog-image-quality-engine-design.md`

## Global Constraints

- Branch: `sprint/v0.6/sprint-6`; do not create another branch for this work.
- Product metadata save and image processing are separate operations. A failed image must not roll back or block the product record.
- A new candidate never replaces the current approved image until explicit approval succeeds.
- `NEEDS_REVIEW` and `REJECTED` candidates are not customer-facing.
- Preserve the existing `Product.dataQualityStatus`; image quality uses a separate `ProductImageQualityStatus`.
- Baseline processing must not require a paid external image API.
- Do not synthesize or reconstruct label text, brand text, flavor, size, ingredients, barcode, claims, or cropped-away packaging.
- Supported upload formats in Sprint 6: JPEG, PNG, WebP. Do not accept SVG, GIF, HEIC, executable/polyglot payloads, or arbitrary file types.
- Hard upload limit: 8 MiB. Hard decoded-pixel limit: 24,000,000 pixels. Hard single-dimension limit: 8,000 pixels.
- Output format: WebP. Card target canvas: maximum 480x480. PDP target canvas: maximum 1000x1000. No source content may be enlarged above 1.25x during derivative generation.
- Existing approved Ysabelle branding, header/nav/footer identity, inventory/POS/forecasting logic, and unrelated customer motion remain unchanged.
- Existing legacy `/images/products/*.webp` assets remain valid while dynamic CIQE assets are introduced.

---

## File Structure

### Backend orchestration

- Create `backend/src/modules/catalog-image/imageUploadPolicy.ts` — magic-byte/type/size upload validation.
- Create `backend/src/modules/catalog-image/catalogImageStorage.ts` — generated storage keys, safe path resolution, read/write/delete primitives.
- Create `backend/src/modules/catalog-image/catalogImageEngineRunner.ts` — bounded Python subprocess invocation and JSON validation.
- Create `backend/src/modules/catalog-image/productImageService.ts` — candidate persistence, processing, approval, rejection, delivery authorization.
- Create `backend/src/controllers/productImageController.ts` — HTTP adapters for upload/preview/approve/reject/delivery.
- Modify `backend/src/middleware/uploadMiddleware.ts` — add dedicated 8 MiB product-image Multer configuration.
- Modify `backend/src/routes/product.routes.ts` — authenticated owner image-candidate endpoints.
- Modify `backend/src/routes/storefront.routes.ts` — public approved variant delivery endpoint.
- Modify `backend/src/config/env.ts` — storage root and image-process timeout configuration.
- Modify `backend/src/security/security.constants.ts` — product-image limits.
- Modify `backend/src/services/storefrontService.ts` and `backend/src/services/catalogQualityPolicy.ts` — active-image variant serialization while preserving legacy paths.

### Persistence

- Modify `database/prisma/schema.prisma` — `ProductImageAsset`, `ProductImageQualityStatus`, `ProductImageProcessingStatus`, active-image relation.
- Create `database/prisma/migrations/20260822200000_catalog_image_engine_foundation/migration.sql`.

### Python CIQE

- Create `catalog-image-engine/requirements.txt` — Pillow dependency.
- Create `catalog-image-engine/ciqe/__init__.py`.
- Create `catalog-image-engine/ciqe/quality.py` — deterministic metrics and classification.
- Create `catalog-image-engine/ciqe/normalize.py` — orientation, background-aware framing, bounded enhancement, safe derivatives.
- Create `catalog-image-engine/app/main.py` — stdin/stdout JSON process contract.
- Create `catalog-image-engine/tests/test_quality.py`.
- Create `catalog-image-engine/tests/test_normalize.py`.
- Keep `scripts/product_image_cutouts.py` behavior intact initially; share/refactor generic logic only after CIQE regression coverage proves parity.

### Frontend

- Modify `frontend/src/services/catalogApi.ts` — image candidate/processing/approval API contracts.
- Create `frontend/src/components/catalog/ProductImageUploadPanel.tsx` — upload, processing, diagnostics, Before/After, approve/replace flow.
- Modify `frontend/src/pages/ProductsPage.tsx` — replace owner URL-entry workflow with the reusable image upload panel for create/edit; product creation remains independent.
- Modify `frontend/src/types/storefront.ts` — optional detail variant URL.
- Modify `frontend/src/pages/customer/ProductDetailPage.tsx` — prefer PDP variant.
- Keep `frontend/src/components/customer/ProductCard.tsx`, `ProductVisual.tsx`, and `ProductImage.tsx` compatible with legacy image URLs.
- Modify `frontend/src/styles/customer.css` only where dynamic variant sizing requires removing legacy per-image heuristics; do not alter approved brand tokens.

### Tests and verification

- Create `backend/test/catalog-image-foundation.test.ts` — upload policy, storage containment, candidate lifecycle, approval invariant.
- Extend `backend/test/catalog-quality.test.ts` — storefront behavior for active approved CIQE image and failed replacement.
- Create `scripts/catalog-image-contract-test.mjs` only if a dependency-free contract test is needed by root guardrails.
- Add CIQE Python tests to repository verification through the smallest existing verification hook that owns Python/runtime checks.

---

## Phase 1 — Secure Upload and Persistence Foundation

### Task 1: Product-image upload policy and storage containment

**Files:**

- Create: `backend/src/modules/catalog-image/imageUploadPolicy.ts`
- Create: `backend/src/modules/catalog-image/catalogImageStorage.ts`
- Create: `backend/test/catalog-image-foundation.test.ts`
- Modify: `backend/src/security/security.constants.ts`
- Modify: `backend/src/config/env.ts`

**Interfaces:**

- Produces: `inspectProductImageUpload(input): ProductImageUploadInspection`
- Produces: `CatalogImageStorage.writeOriginal(candidateId, extension, buffer): Promise<string>`
- Produces: `CatalogImageStorage.resolveStorageKey(key): string`
- Produces constants for 8 MiB / 24 MP / 8000 px limits.

- [ ] **Step 1: Write failing upload-policy tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { inspectProductImageUpload } from "../src/modules/catalog-image/imageUploadPolicy.js";

test("product image upload trusts magic bytes instead of filename or declared MIME", () => {
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
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm run test --workspace @ysabellestore/backend -- --test-name-pattern="product image upload"`
Expected: FAIL because `imageUploadPolicy.ts` does not exist.

- [ ] **Step 3: Implement magic-byte detection and limits**

Implement JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`, and WebP `RIFF....WEBP`; reject all other formats. The returned extension must come from detected bytes, never from `originalname`.

- [ ] **Step 4: Add storage-containment test before storage implementation**

```ts
test("catalog image storage never derives a path from the user filename", async () => {
  const storage = new CatalogImageStorage(tempDirectory);
  const key = await storage.writeOriginal("candidate-1", ".png", Buffer.from("bytes"));
  assert.equal(key, "candidates/candidate-1/original.png");
  assert.ok(storage.resolveStorageKey(key).startsWith(tempDirectory));
  assert.throws(() => storage.resolveStorageKey("../../escape.webp"));
});
```

- [ ] **Step 5: Run and verify RED, then implement generated keys and root containment**

Use `path.resolve` plus an explicit root-prefix check. Create parent directories with `recursive: true`; never concatenate an uploaded filename into a filesystem path.

- [ ] **Step 6: Run focused tests GREEN and commit**

Run: `npm run test --workspace @ysabellestore/backend -- --test-name-pattern="product image|catalog image storage"`
Expected: PASS.

Commit: `feat: add secure catalog image upload primitives`

### Task 2: Persist candidates separately from the active image

**Files:**

- Modify: `database/prisma/schema.prisma`
- Create: `database/prisma/migrations/20260822200000_catalog_image_engine_foundation/migration.sql`
- Extend: `backend/test/catalog-image-foundation.test.ts`

**Interfaces:**

- Produces Prisma model `ProductImageAsset`.
- Adds `Product.activeImageAssetId` and relations while retaining legacy `Product.imageUrl`.

Schema contract:

```prisma
enum ProductImageQualityStatus {
  APPROVED
  NEEDS_REVIEW
  REJECTED
}

enum ProductImageProcessingStatus {
  PENDING
  PROCESSING
  READY
  FAILED
}

model ProductImageAsset {
  id                  String                       @id @default(cuid()) @db.VarChar(191)
  productId           String                       @map("product_id") @db.VarChar(191)
  qualityStatus       ProductImageQualityStatus    @default(NEEDS_REVIEW) @map("quality_status")
  processingStatus    ProductImageProcessingStatus @default(PENDING) @map("processing_status")
  originalStorageKey  String                       @map("original_storage_key") @db.VarChar(500)
  processedStorageKey String?                      @map("processed_storage_key") @db.VarChar(500)
  cardStorageKey      String?                      @map("card_storage_key") @db.VarChar(500)
  pdpStorageKey       String?                      @map("pdp_storage_key") @db.VarChar(500)
  sourceMimeType      String                       @map("source_mime_type") @db.VarChar(80)
  sourceBytes         Int                          @map("source_bytes") @db.UnsignedInt
  sourceWidth         Int?                         @map("source_width") @db.UnsignedInt
  sourceHeight        Int?                         @map("source_height") @db.UnsignedInt
  diagnostics         Json?
  processingVersion   String                       @default("ciqe-v1") @map("processing_version") @db.VarChar(40)
  approvedAt          DateTime?                    @map("approved_at")
  rejectedAt          DateTime?                    @map("rejected_at")
  supersededAt        DateTime?                    @map("superseded_at")
  createdAt           DateTime                     @default(now()) @map("created_at")
  updatedAt           DateTime                     @updatedAt @map("updated_at")
  product             Product                      @relation("ProductImageAssets", fields: [productId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  activeForProduct    Product?                     @relation("ActiveProductImage")

  @@index([productId, createdAt], map: "idx_product_image_assets_product_created")
  @@index([productId, qualityStatus, processingStatus], map: "idx_product_image_assets_quality")
  @@map("product_image_assets")
}
```

- [ ] **Step 1: Add a failing database lifecycle test** proving a product can own a candidate while `imageUrl` and `activeImageAssetId` remain unchanged.
- [ ] **Step 2: Run test RED**; expected Prisma client/schema failure because the model/relation does not exist.
- [ ] **Step 3: Add schema relation + explicit SQL migration**; add `activeImageAssetId String? @unique` to `Product`, `imageAssets`, and `activeImageAsset` relations.
- [ ] **Step 4: Run `npm run prisma:validate` and `npm run prisma:generate`**.
- [ ] **Step 5: Re-run focused lifecycle test GREEN**.
- [ ] **Step 6: Commit** `feat: add product image candidate persistence`.

### Task 3: Owner upload endpoint creates a candidate without changing product publication

**Files:**

- Modify: `backend/src/middleware/uploadMiddleware.ts`
- Create: `backend/src/modules/catalog-image/productImageService.ts`
- Create: `backend/src/controllers/productImageController.ts`
- Modify: `backend/src/routes/product.routes.ts`
- Extend: `backend/test/catalog-image-foundation.test.ts`

**Interfaces:**

- `POST /api/catalog/products/:id/images` with multipart field `image`.
- Returns candidate id, `PENDING`/`NEEDS_REVIEW`, original metadata, and no public storefront URL.

- [ ] **Step 1: Write failing service test**: upload to an existing product with an existing approved `imageUrl`; assert a candidate is created and the product's current image fields are unchanged.
- [ ] **Step 2: Run test RED** because the service does not exist.
- [ ] **Step 3: Add `productImageUpload` Multer memory storage** with one file and `8 * 1024 * 1024` limit.
- [ ] **Step 4: Implement `createProductImageCandidate(productId, file)`**: verify product exists, inspect bytes, allocate generated id/storage key, write original, create DB record; delete the stored original if DB creation fails.
- [ ] **Step 5: Add owner-only route/controller**. Missing multipart field returns `PRODUCT_IMAGE_REQUIRED`; invalid file returns stable 4xx error code.
- [ ] **Step 6: Re-run focused tests GREEN and commit** `feat: add product image candidate upload`.

---

## Phase 2 — Deterministic CIQE Quality Analysis

### Task 4: Python process contract and hard decode limits

**Files:**

- Create: `catalog-image-engine/requirements.txt`
- Create: `catalog-image-engine/ciqe/__init__.py`
- Create: `catalog-image-engine/ciqe/quality.py`
- Create: `catalog-image-engine/app/main.py`
- Create: `catalog-image-engine/tests/test_quality.py`

**Interfaces:**

- stdin JSON: `{ "sourcePath": string, "outputDirectory": string }`
- stdout JSON: `{ "status": "APPROVED"|"NEEDS_REVIEW"|"REJECTED", "source": {...}, "diagnostics": [...], "metrics": {...} }`
- Non-zero exit only for process/contract failure; a poor but decodeable image returns a normal JSON `NEEDS_REVIEW`/`REJECTED` result.

Initial deterministic policy:

- decode failure => `REJECTED` reason `DECODE_FAILED`;
- > 24 MP or any dimension >8000 => `REJECTED` reason `PIXEL_LIMIT_EXCEEDED`;
- short side <96 => `REJECTED` reason `RESOLUTION_TOO_LOW`;
- short side 96..479 => at least `NEEDS_REVIEW` reason `PDP_RESOLUTION_LOW`;
- foreground occupancy <0.20 => `NEEDS_REVIEW` `PRODUCT_TOO_SMALL_IN_FRAME`;
- foreground occupancy >0.92 => `NEEDS_REVIEW` `PRODUCT_TOO_LARGE_IN_FRAME`;
- foreground bbox touching the safe 1.5% frame margin => `NEEDS_REVIEW` `LIKELY_CROP_RISK`;
- mean luminance <35 or >235 => `NEEDS_REVIEW` `EXPOSURE_RISK`;
- grayscale contrast standard deviation <15 => `NEEDS_REVIEW` `LOW_CONTRAST`;
- high-pass RMS <8 => `NEEDS_REVIEW` `BLUR_RISK`.

- [ ] **Step 1: Write synthetic-image tests first** using Pillow-created sharp, blurred, tiny, excess-whitespace, and edge-touching fixtures.
- [ ] **Step 2: Run `python -m unittest discover -s catalog-image-engine/tests -p 'test_*.py'` and verify RED**.
- [ ] **Step 3: Implement decode guards, edge-background estimate, foreground bounds, luminance/contrast/high-pass metrics, and status escalation**.
- [ ] **Step 4: Re-run tests GREEN**.
- [ ] **Step 5: Commit** `feat: add deterministic catalog image quality analysis`.

### Task 5: Safe normalization and card/PDP derivative generation

**Files:**

- Create: `catalog-image-engine/ciqe/normalize.py`
- Create: `catalog-image-engine/tests/test_normalize.py`
- Modify: `catalog-image-engine/app/main.py`

**Interfaces:**

- Produces `processed.webp`, `card.webp`, `pdp.webp` only for decodeable candidates.
- JSON adds `variants.processed`, `variants.card`, `variants.pdp` with dimensions/storage filenames.

Normalization policy:

- apply EXIF transpose;
- preserve aspect ratio;
- crop only excess edge-connected near-background where confidence is high;
- add 4% safe padding, minimum 8 px;
- mild bounded enhancement only: contrast factor 1.03 and sharpness factor 1.08;
- WebP quality 90;
- card max 480x480, PDP max 1000x1000;
- never enlarge product raster >1.25x;
- if background isolation is not reliable, preserve the full photograph instead of erasing uncertain pixels.

- [ ] **Step 1: Write failing tests** proving orientation correction, no stretching, full foreground containment, safe padding, and the 1.25x upscale ceiling.
- [ ] **Step 2: Run RED**.
- [ ] **Step 3: Implement minimal normalization and derivative functions**.
- [ ] **Step 4: Run GREEN; verify generated variants can be decoded and preserve expected bounds**.
- [ ] **Step 5: Commit** `feat: normalize catalog product images safely`.

### Task 6: Node runner connects uploaded candidates to CIQE

**Files:**

- Create: `backend/src/modules/catalog-image/catalogImageEngineRunner.ts`
- Modify: `backend/src/modules/catalog-image/productImageService.ts`
- Modify: `backend/src/config/env.ts`
- Extend: `backend/test/catalog-image-foundation.test.ts`

**Interfaces:**

- `runCatalogImageEngine(sourcePath, outputDirectory): Promise<CatalogImageEngineResult>`
- `processProductImageCandidate(candidateId): Promise<ProductImageAsset>`

- [ ] **Step 1: Write failing parser/runner contract test** for valid JSON, invalid JSON, timeout, and non-zero child exit.
- [ ] **Step 2: Run RED**.
- [ ] **Step 3: Mirror the existing forecasting `spawn(..., { shell:false })` pattern**; use `PYTHON_EXECUTABLE`, add `CATALOG_IMAGE_PROCESS_TIMEOUT_MS` default `20_000`, bound stdout/stderr capture, and reject invalid result shapes.
- [ ] **Step 4: Processing lifecycle**: DB `PENDING -> PROCESSING -> READY`; process failure => `FAILED` + `NEEDS_REVIEW`, preserve product's active image.
- [ ] **Step 5: Persist dimensions, diagnostics, quality status, and storage keys returned by CIQE**.
- [ ] **Step 6: Run focused backend tests GREEN and Python tests GREEN**.
- [ ] **Step 7: Commit** `feat: connect catalog image engine to product candidates`.

---

## Phase 3 — Atomic Approval, Delivery, and Storefront Variants

### Task 7: Approval/rejection lifecycle cannot displace a good image accidentally

**Files:**

- Modify: `backend/src/modules/catalog-image/productImageService.ts`
- Modify: `backend/src/controllers/productImageController.ts`
- Modify: `backend/src/routes/product.routes.ts`
- Extend: `backend/test/catalog-image-foundation.test.ts`

**Interfaces:**

- `POST /api/catalog/products/:productId/images/:imageId/approve`
- `POST /api/catalog/products/:productId/images/:imageId/reject`

- [ ] **Step 1: Write failing regression test**: product has active approved asset A; replacement B is `NEEDS_REVIEW` or `REJECTED`; approving B must fail and A must remain active.
- [ ] **Step 2: Run RED**.
- [ ] **Step 3: Implement atomic approval transaction** requiring matching product, `READY`, `APPROVED`, and all three processed storage keys; set previous asset `supersededAt`, set `Product.activeImageAssetId`, and set legacy `Product.imageUrl` to the immutable approved card URL.
- [ ] **Step 4: Implement explicit rejection** without touching active asset.
- [ ] **Step 5: Run GREEN and commit** `feat: add safe catalog image approval lifecycle`.

### Task 8: Deliver previews privately and active variants publicly

**Files:**

- Modify: `backend/src/controllers/productImageController.ts`
- Modify: `backend/src/routes/product.routes.ts`
- Modify: `backend/src/routes/storefront.routes.ts`
- Modify: `backend/src/modules/catalog-image/productImageService.ts`
- Extend: `backend/test/catalog-image-foundation.test.ts`

**Interfaces:**

- Owner preview: `GET /api/catalog/products/:productId/images/:imageId/preview/:variant` where variant is `original|processed|card|pdp`.
- Storefront: `GET /api/storefront/product-images/:imageId/:variant` where variant is `card|pdp` and the asset must be the product's active approved asset.

- [ ] **Step 1: Write failing delivery authorization tests**: rejected/pending assets cannot be served publicly; another product's asset cannot be fetched through a mismatched product route.
- [ ] **Step 2: Run RED**.
- [ ] **Step 3: Implement storage reads through `resolveStorageKey` only**.
- [ ] \*\*Step 4: Set preview `Cache-Control: private, no-store`; approved immutable variant `Cache-Control: public, max-age=31536000, immutable`; set `Content-Type: image/webp` for processed variants.
- [ ] **Step 5: Override CORP on approved image responses only as required for the configured frontend/backend origin split**.
- [ ] **Step 6: Run GREEN and commit** `feat: serve approved catalog image variants safely`.

### Task 9: Storefront serializers prefer active CIQE variants while keeping legacy images

**Files:**

- Modify: `backend/src/services/catalogQualityPolicy.ts`
- Modify: `backend/src/services/storefrontService.ts`
- Modify: `backend/test/catalog-quality.test.ts`

**Interfaces:**

- Storefront product adds `detailImageUrl: string | null`.
- Existing `imageUrl` remains the card URL and remains compatible with legacy `/images/products/*.webp` products.

- [ ] **Step 1: Write failing storefront regression** for an active CIQE asset and for a legacy static image product.
- [ ] **Step 2: Run RED**.
- [ ] **Step 3: Include active image asset relation in storefront queries and serialize card/PDP variant URLs**; fallback to legacy `Product.imageUrl` for products without an active CIQE asset.
- [ ] **Step 4: Preserve current catalog-quality/duplicate/visibility gates**.
- [ ] **Step 5: Run `catalog-quality`, storefront, and product-detail backend tests GREEN**.
- [ ] **Step 6: Commit** `feat: use approved image variants in storefront`.

---

## Phase 4 — Retailer Before/After Workflow

### Task 10: Frontend API contracts for candidate upload and approval

**Files:**

- Modify: `frontend/src/services/catalogApi.ts`

**Interfaces:**

```ts
export type ProductImageCandidate = {
  id: string;
  productId: string;
  qualityStatus: "APPROVED" | "NEEDS_REVIEW" | "REJECTED";
  processingStatus: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  diagnostics: Array<{ code: string; message: string; severity: "info" | "warning" | "error" }>;
  previewUrls: { original: string; processed: string | null };
};
```

Add `uploadProductImage(productId, file)`, `approveProductImage(productId, imageId)`, and `rejectProductImage(productId, imageId)`.

- [ ] **Step 1: Add/extend the existing frontend API contract test or dependency-free script to fail on missing exports**.
- [ ] **Step 2: Run RED**.
- [ ] **Step 3: Implement multipart upload using the existing `apiClient` form-data path and JSON approval/rejection requests**.
- [ ] **Step 4: Run frontend typecheck/contract test GREEN**.
- [ ] **Step 5: Commit** `feat: add catalog image frontend api`.

### Task 11: Reusable owner image upload/preview panel

**Files:**

- Create: `frontend/src/components/catalog/ProductImageUploadPanel.tsx`
- Modify tests/scripts only as needed for UI contract coverage.

**Behavior:**

- local file picker accepts `.jpg,.jpeg,.png,.webp`;
- validates 8 MiB client-side for fast feedback but server remains authoritative;
- states: `idle`, `selected`, `uploading`, `processing`, `preview`, `needs-review`, `rejected`, `approved`, `error`;
- Before/After is shown only when processed preview exists;
- `APPROVED` candidate exposes **Use Optimized Image**;
- `NEEDS_REVIEW`/`REJECTED` show reason(s) and **Upload Another**; there is no **Use anyway** path;
- keyboard/focus and responsive behavior use existing UI primitives.

- [ ] **Step 1: Write a failing UI/contract test for the state model and button gating**.
- [ ] **Step 2: Run RED**.
- [ ] **Step 3: Implement the smallest project-native panel using existing Button/Alert/LoadingState primitives**.
- [ ] **Step 4: Run typecheck/lint and targeted UI contract GREEN**.
- [ ] **Step 5: Commit** `feat: add product image optimization preview`.

### Task 12: Integrate image upload into Add/Edit Product without blocking product save

**Files:**

- Modify: `frontend/src/pages/ProductsPage.tsx` around `CreateProductDialog` and `ProductDetailsDialog`.
- Use: `frontend/src/components/catalog/ProductImageUploadPanel.tsx`.

**Create behavior:**

1. owner may select a file before submit;
2. `createProduct(...)` saves metadata first;
3. when product creation succeeds, upload/process selected file using returned product id;
4. if image upload/process fails, retain the created product and show `Product created; image needs attention` rather than reporting creation failure;
5. if candidate is approved by CIQE, show Before/After and allow explicit promotion.

**Edit behavior:**

- replacement candidate is processed beside the current active image;
- cancel/reject/failed processing leaves active image untouched.

- [ ] **Step 1: Add a failing flow contract test proving product creation success is not converted into product failure by image failure**.
- [ ] **Step 2: Run RED**.
- [ ] **Step 3: Remove the normal owner-facing image URL text box from create/edit and embed `ProductImageUploadPanel`; keep backend/import legacy `imageUrl` support for existing data migration compatibility**.
- [ ] **Step 4: Implement create-then-upload sequencing and edit replacement flow**.
- [ ] **Step 5: Run frontend typecheck/lint/contract GREEN**.
- [ ] **Step 6: Commit** `feat: integrate automatic product image preparation`.

### Task 13: PDP uses detail variant; card remains optimized

**Files:**

- Modify: `frontend/src/types/storefront.ts`
- Modify: `frontend/src/pages/customer/ProductDetailPage.tsx`
- Modify: `frontend/src/services/storefrontService.ts` if type mapping is explicit there.
- Modify: `frontend/src/styles/customer.css` only if required by dynamic image behavior.

- [ ] **Step 1: Write failing storefront UI contract** expecting `detailImageUrl` to be used by the large product visual when present.
- [ ] **Step 2: Run RED**.
- [ ] **Step 3: Add optional `detailImageUrl`; PDP uses `product.detailImageUrl ?? product.imageUrl`; cards continue using `imageUrl`**.
- [ ] **Step 4: Keep `object-fit: contain`, centered presentation, and low-resolution anti-upscale behavior; remove only legacy heuristics made obsolete by CIQE derivatives**.
- [ ] **Step 5: Run storefront UI checks GREEN and commit** `feat: use dedicated product detail image variant`.

---

## Phase 5 — Local Vision Boundary, Corpus, Hardening, and Performance

### Task 14: Local vision adapter boundary without making AI mandatory

**Files:**

- Create: `catalog-image-engine/ciqe/subject.py`
- Extend: `catalog-image-engine/tests/test_normalize.py`

**Interface:**

```py
class SubjectDetector(Protocol):
    def detect(self, image: Image.Image) -> SubjectDetection | None: ...
```

Baseline implementation is `EdgeConnectedBackgroundDetector`, using deterministic edge-connected matte logic derived from the existing `scripts/product_image_cutouts.py` approach. A future local ML adapter may implement the same protocol without changing upload/publishing code.

- [ ] **Step 1: Write failing tests** for clean light-background isolation and complex-background fallback.
- [ ] **Step 2: Run RED**.
- [ ] **Step 3: Implement deterministic adapter and fallback**; uncertain detection returns `None`, causing normalization to preserve the full photograph.
- [ ] **Step 4: Run GREEN**.
- [ ] **Step 5: Do not add a heavyweight segmentation model unless the representative corpus proves the deterministic path insufficient and the model can run locally without violating deployment constraints**.
- [ ] **Step 6: Commit** `feat: add pluggable product subject detection`.

### Task 15: Representative image regression corpus and truthfulness checks

**Files:**

- Create generated/synthetic fixtures under `catalog-image-engine/tests/fixtures/` only when binary fixture size is justified.
- Reuse existing licensed/preserved product originals under `frontend/public/images/products/originals/` for read-only regression where licensing already belongs to the project.
- Extend Python/backend tests.

Corpus covers cans, bottles, sachets, boxes, portrait/landscape, low resolution, blur, excess whitespace, edge clipping, complex background, transparent source, and already-normalized input.

- [ ] **Step 1: Add failing regression assertions for known failure classes**.
- [ ] **Step 2: Run RED and adjust deterministic logic only when a regression demonstrates a real defect; never reconstruct missing label/package content**.
- [ ] **Step 3: Run full Python corpus GREEN**.
- [ ] **Step 4: Verify legacy curated cutout script still passes `npm run product-images:cutouts:verify`**.
- [ ] **Step 5: Commit** `test: add catalog image quality regression corpus`.

### Task 16: Performance, cleanup, and full verification

**Files:**

- Modify `backend/src/modules/catalog-image/productImageService.ts` for superseded/rejected candidate cleanup policy if needed.
- Update Sprint 6 evidence docs with measured results only.

Performance acceptance for an 8 MiB-or-smaller / <=24 MP image on the supported development machine:

- API event loop remains responsive because image work is in the Python child process;
- process timeout is 20 seconds;
- peak decoded image protection is enforced by pixel limits/Pillow guard;
- no unbounded stdout/stderr accumulation;
- rejected/superseded originals are not deleted while referenced by an active asset.

- [ ] **Step 1: Run Python unit/regression suite**: `python -m unittest discover -s catalog-image-engine/tests -p 'test_*.py'`.
- [ ] **Step 2: Run backend image tests and existing catalog/storefront suites**.
- [ ] **Step 3: Run frontend typecheck/lint and targeted storefront/product UI contract tests**.
- [ ] **Step 4: Run `npm run prisma:validate` and `npm run prisma:generate`**.
- [ ] **Step 5: Run existing image regressions**: `npm run product-images:cutouts:verify`, `npm run product-images:test`, `npm run storefront:images:verify`.
- [ ] **Step 6: Run repository verification required by active Sprint 6 guardrails**: `npm run verify:code` and then the appropriate pre-push/local guardrail command if this is being prepared for push.
- [ ] **Step 7: Record actual timing/memory observations; do not claim values that were not measured**.
- [ ] **Step 8: Update `docs/sprints/sprint-6/SPRINT-BACKLOG.md` and `DEFINITION-OF-DONE.md` only for items backed by evidence**.
- [ ] **Step 9: Commit** `chore: finalize sprint 6 catalog image engine verification`.

---

## Self-Review

- Spec coverage: upload, storage, deterministic analysis, safe normalization, variants, independent product save, approval/rejection, Before/After UX, storefront safety, local-vision adapter, regression/security/performance are each assigned to explicit tasks.
- Scope control: public-web image discovery remains deferred; no arbitrary web search/publishing is mixed into this sprint.
- Type consistency: product catalog quality and image quality are separate; candidate ids and storage keys remain distinct from public URLs.
- Compatibility: existing static `/images/products/*.webp` products remain supported while dynamic CIQE assets become the preferred path for newly uploaded owner images.
- TDD: every production behavior task begins with a failing focused test and requires observed RED before minimal implementation.
