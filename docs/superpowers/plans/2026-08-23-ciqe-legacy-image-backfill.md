# CIQE Legacy Image Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reprocess the existing legacy product images through the existing CIQE pipeline, keep the current storefront image live until explicit owner approval, and expose backfilled candidates in the existing product-image review UI.

**Architecture:** Add one backend backfill module that safely resolves retained originals, classifies eligible products, and reuses `createProductImageCandidate`. Add a dry-run-by-default CLI, plus a latest-candidate owner endpoint so the current upload panel can hydrate backfilled candidates without changing approval semantics. No new image-processing algorithm or Prisma schema is introduced.

**Tech Stack:** Node.js 20+, TypeScript, Express, Prisma/MySQL, React, existing Python/Pillow CIQE engine, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-23-ciqe-legacy-image-backfill-design.md`

## Global Constraints

- Stay on `sprint/v0.6/sprint-6`; do not create another branch or merge.
- Reuse the existing `createProductImageCandidate` / CIQE processing path; do not add a second image algorithm.
- Do not auto-approve or auto-publish backfilled images.
- Never replace `Product.imageUrl` or `activeImageAssetId` until the existing explicit approval action succeeds.
- `NEEDS_REVIEW`, `REJECTED`, failed, missing-source, and unsafe-source cases leave the current storefront image unchanged.
- Only local legacy URLs under `/images/products/<basename>` may map to `frontend/public/images/products/originals/<basename>`.
- Reject traversal, nested paths, absolute paths, query/hash variants, remote URLs, and CIQE routes.
- Skip products that already have any `ProductImageAsset` history; existing manual/CIQE work wins.
- Dry run is the default. Mutation requires `--apply`.
- Keep CIQE heavy processing serialized through the existing process gate.
- No internet image fetches, generative reconstruction, package-detail invention, branding changes, or unrelated storefront redesign.
- No Prisma schema migration is required for this backfill.

---

### Task 1: Safe legacy-source resolution and eligibility planning

**Files:**

- Create: `backend/src/modules/catalog-image/legacyImageBackfill.ts`
- Create: `backend/test/catalog-image-backfill.test.ts`
- Modify: `backend/package.json`

**Interfaces:**

- Consumes: Prisma `Product` / `ProductImageAsset` state and repository root.
- Produces:
  - `resolveLegacyProductImageSource(repositoryRoot: string, imageUrl: string | null): string | null`
  - `planLegacyProductImageBackfill(options?: { productId?: string; repositoryRoot?: string }): Promise<LegacyImageBackfillPlanItem[]>`
  - `LegacyImageBackfillPlanItem` with `productId`, `productName`, `imageUrl`, `status`, `reason`, and optional `sourcePath`.

- [ ] **Step 1: Write resolver and planning regression tests**

Add cases to `backend/test/catalog-image-backfill.test.ts` that assert:

```ts
assert.equal(
  resolveLegacyProductImageSource(repoRoot, "/images/products/ligo.webp"),
  path.join(repoRoot, "frontend", "public", "images", "products", "originals", "ligo.webp")
);
assert.equal(resolveLegacyProductImageSource(repoRoot, "/images/products/../secret.webp"), null);
assert.equal(
  resolveLegacyProductImageSource(repoRoot, "/images/products/nested/secret.webp"),
  null
);
assert.equal(resolveLegacyProductImageSource(repoRoot, "https://example.com/ligo.webp"), null);
assert.equal(
  resolveLegacyProductImageSource(repoRoot, "/api/storefront/product-images/abc/card"),
  null
);
assert.equal(resolveLegacyProductImageSource(repoRoot, "/images/products/ligo.webp?x=1"), null);
```

Create database fixtures proving that a legacy product with no image-asset history is `ELIGIBLE`, while a product with an existing image asset is `SKIPPED` with reason `IMAGE_ASSET_EXISTS`.

- [ ] **Step 2: Run the new backend test and confirm RED**

Run:

```bash
npx tsx --test --test-concurrency=1 backend/test/catalog-image-backfill.test.ts
```

Expected: FAIL because `legacyImageBackfill.ts` and its exports do not exist yet.

- [ ] **Step 3: Implement the safe resolver and planner**

Use a strict pathname match rather than URL/path normalization:

```ts
const LEGACY_PRODUCT_IMAGE_PATTERN = /^\/images\/products\/([^/?#\\]+)$/;

export function resolveLegacyProductImageSource(repositoryRoot: string, imageUrl: string | null) {
  if (!imageUrl) return null;
  const match = LEGACY_PRODUCT_IMAGE_PATTERN.exec(imageUrl);
  const basename = match?.[1];
  if (!basename || basename === "." || basename === "..") return null;
  return path.join(
    repositoryRoot,
    "frontend",
    "public",
    "images",
    "products",
    "originals",
    basename
  );
}
```

`planLegacyProductImageBackfill` should query products with the optional exact `productId`, select `id`, `name`, `imageUrl`, `activeImageAssetId`, and image-asset count, then classify in this order:

```text
ACTIVE_IMAGE_EXISTS
IMAGE_ASSET_EXISTS
NO_LEGACY_IMAGE
UNSAFE_OR_UNSUPPORTED_LEGACY_URL
SOURCE_NOT_FOUND
ELIGIBLE
```

Use `fs.access` for source existence. Do not mutate database or storage during planning.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run:

```bash
npx tsx --test --test-concurrency=1 backend/test/catalog-image-backfill.test.ts
```

Expected: resolver and eligibility cases PASS.

- [ ] **Step 5: Add the new test file to the backend workspace test command and commit**

Append `test/catalog-image-backfill.test.ts` to `backend/package.json`'s explicit `test` script.

Commit:

```bash
git add backend/src/modules/catalog-image/legacyImageBackfill.ts backend/test/catalog-image-backfill.test.ts backend/package.json
git commit -m "feat: plan legacy CIQE image backfill"
```

---

### Task 2: Dry-run/apply backfill execution and CLI

**Files:**

- Modify: `backend/src/modules/catalog-image/legacyImageBackfill.ts`
- Modify: `backend/test/catalog-image-backfill.test.ts`
- Create: `backend/src/scripts/backfillCatalogImages.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: `planLegacyProductImageBackfill`, `createProductImageCandidate(productId, file)`.
- Produces:
  - `runLegacyProductImageBackfill(options: { apply: boolean; productId?: string; repositoryRoot?: string }): Promise<LegacyImageBackfillResult>`
  - root command `npm run catalog-images:backfill -- [--apply] [--product <product-id>]`.

- [ ] **Step 1: Add RED tests for dry-run, apply, and idempotence**

Use a fixture product whose `imageUrl` basename maps to one of the retained originals already in the repository. Assert:

```ts
const before = await prisma.productImageAsset.count({ where: { productId: product.id } });
const dryRun = await runLegacyProductImageBackfill({
  apply: false,
  productId: product.id,
  repositoryRoot: repoRoot
});
const afterDryRun = await prisma.productImageAsset.count({ where: { productId: product.id } });
assert.equal(before, afterDryRun);
assert.equal(dryRun.eligible, 1);
```

Then run with `apply: true` and assert exactly one `ProductImageAsset` exists, while:

```ts
assert.equal(reloadedProduct.imageUrl, legacyImageUrl);
assert.equal(reloadedProduct.activeImageAssetId, null);
```

Run `apply: true` a second time and assert the asset count remains `1`.

- [ ] **Step 2: Run focused test and confirm RED**

Run:

```bash
npx tsx --test --test-concurrency=1 backend/test/catalog-image-backfill.test.ts
```

Expected: FAIL because `runLegacyProductImageBackfill` does not exist.

- [ ] **Step 3: Implement the backfill runner**

For each planned `ELIGIBLE` item when `apply === true`:

```ts
const buffer = await readFile(item.sourcePath);
const candidate = await createProductImageCandidate(item.productId, {
  buffer,
  mimetype: "application/octet-stream",
  originalname: path.basename(item.sourcePath),
  size: buffer.length
});
```

Before creating, re-check that the product still has no `activeImageAssetId` and no image assets. Process sequentially with `for ... of`; do not add a second concurrency mechanism.

Count result buckets as `eligible`, `processed`, `approvedQuality`, `needsReview`, `rejected`, `failed`, and `skipped`. `approvedQuality` is diagnostic only and must never call `approveProductImageCandidate`.

Expected per-product quality outcomes do not abort the batch. Unexpected command-level/database failures may throw.

- [ ] **Step 4: Implement the CLI parser and root command**

`backend/src/scripts/backfillCatalogImages.ts` must accept only:

```text
--apply
--product <product-id>
--product=<product-id>
```

Unknown flags or a missing product value throw an actionable error. Default is dry-run. Print each planned/processed product and a final count summary. Add to root `package.json`:

```json
"catalog-images:backfill": "tsx backend/src/scripts/backfillCatalogImages.ts"
```

- [ ] **Step 5: Run focused backend test and CLI dry run**

Run:

```bash
npx tsx --test --test-concurrency=1 backend/test/catalog-image-backfill.test.ts
npm run catalog-images:backfill
```

Expected: tests PASS; CLI reports eligible/skipped items and performs no mutation.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/catalog-image/legacyImageBackfill.ts backend/test/catalog-image-backfill.test.ts backend/src/scripts/backfillCatalogImages.ts package.json
git commit -m "feat: add safe CIQE legacy image backfill"
```

---

### Task 3: Latest-candidate owner API

**Files:**

- Modify: `backend/src/modules/catalog-image/productImageService.ts`
- Modify: `backend/src/controllers/productImageController.ts`
- Modify: `backend/src/routes/product.routes.ts`
- Modify: `backend/test/catalog-image-backfill.test.ts`

**Interfaces:**

- Produces:
  - `getLatestProductImageCandidate(productId: string)` returning the latest `ProductImageAsset | null` after verifying the product exists.
  - `GET /api/catalog/products/:productId/images/latest` (OWNER only), response data `{ candidate: ProductImageAsset | null }`.

- [ ] **Step 1: Add a RED latest-candidate service test**

Create two image assets for the same product with different `createdAt` values and assert:

```ts
const latest = await getLatestProductImageCandidate(product.id);
assert.equal(latest?.id, newer.id);
```

Also assert a product with no candidate returns `null`, while an unknown product throws `PRODUCT_NOT_FOUND`.

- [ ] **Step 2: Run focused test and confirm RED**

Run:

```bash
npx tsx --test --test-concurrency=1 backend/test/catalog-image-backfill.test.ts
```

Expected: FAIL because `getLatestProductImageCandidate` is missing.

- [ ] **Step 3: Implement service/controller/route**

Service behavior:

```ts
const product = await prisma.product.findUnique({ select: { id: true }, where: { id: productId } });
if (!product) throw new HttpError(404, "Product was not found.", { code: "PRODUCT_NOT_FOUND" });
return prisma.productImageAsset.findFirst({
  orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  where: { productId }
});
```

Controller returns:

```ts
createSuccessResponse("Latest product image candidate loaded.", { candidate });
```

Register before generic product detail routes:

```ts
productRouter.get(
  "/:productId/images/latest",
  requireRole("OWNER"),
  getLatestProductImageController
);
```

- [ ] **Step 4: Run focused backend tests and commit**

Run:

```bash
npx tsx --test --test-concurrency=1 backend/test/catalog-image-backfill.test.ts
```

Expected: PASS.

Commit:

```bash
git add backend/src/modules/catalog-image/productImageService.ts backend/src/controllers/productImageController.ts backend/src/routes/product.routes.ts backend/test/catalog-image-backfill.test.ts
git commit -m "feat: expose latest CIQE image candidate"
```

---

### Task 4: Hydrate backfilled candidates in the existing image review panel

**Files:**

- Modify: `frontend/src/services/productImageApi.ts`
- Modify: `frontend/src/components/catalog/ProductImageUploadPanel.tsx`
- Create: `scripts/test/catalog-image-backfill-ui.test.mjs`

**Interfaces:**

- Produces: `fetchLatestProductImageCandidate(productId: string, signal?: AbortSignal): Promise<ProductImageCandidate | null>`.
- The panel continues using the existing `approveProductImage`, `fetchProductImagePreviewBlob`, and upload flow.

- [ ] **Step 1: Add a RED UI contract regression test**

The Node guardrail test should read the two frontend files and assert that:

```js
assert.match(apiSource, /fetchLatestProductImageCandidate/);
assert.match(panelSource, /fetchLatestProductImageCandidate/);
assert.match(panelSource, /fetchProductImagePreviewBlob\(productId, candidate\.id, "original"/);
assert.match(panelSource, /Use Optimized Image/);
```

This protects the intended hydration path without introducing a new frontend test framework.

- [ ] **Step 2: Run guardrail test and confirm RED**

Run:

```bash
node --test scripts/test/catalog-image-backfill-ui.test.mjs
```

Expected: FAIL because latest-candidate hydration is not implemented.

- [ ] **Step 3: Add the frontend latest-candidate API call**

Implement:

```ts
export async function fetchLatestProductImageCandidate(productId: string, signal?: AbortSignal) {
  const response = await apiClient.request<{ candidate: ProductImageCandidate | null }>(
    `/api/catalog/products/${encodeURIComponent(productId)}/images/latest`,
    { signal }
  );
  if (!response.success || !response.data) throw new Error(response.message);
  return response.data.candidate;
}
```

- [ ] **Step 4: Hydrate the panel without changing approval semantics**

When `productId` / `resetKey` starts a new edit session and no local file has been chosen:

1. clear stale state;
2. fetch the latest candidate;
3. if one exists, set it as `candidate`;
4. load its owner `original` preview blob;
5. reuse the existing processed-preview loader for `READY` candidates;
6. derive display phase as `approved` when `approvedAt` is set, `error` when processing failed, otherwise `preview`;
7. show the Original/Optimized preview grid when either `selectedFile` **or** `candidate` exists;
8. keep `canApprove` unchanged so only `qualityStatus === "APPROVED" && processingStatus === "READY"` exposes `Use Optimized Image`;
9. a newly selected file supersedes only panel state, not the current published image.

Do not call approval automatically from hydration.

- [ ] **Step 5: Run UI contract, typecheck, lint, and format check**

Run:

```bash
node --test scripts/test/catalog-image-backfill-ui.test.mjs
npm run typecheck
npm run lint
npm run format:check
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/services/productImageApi.ts frontend/src/components/catalog/ProductImageUploadPanel.tsx scripts/test/catalog-image-backfill-ui.test.mjs
git commit -m "feat: review backfilled CIQE candidates in products"
```

---

### Task 5: Full verification and controlled Ligo rollout

**Files:**

- Modify: `docs/sprints/sprint-6/PHASE-5-VERIFICATION-EVIDENCE.md`
- Modify: `docs/sprints/sprint-6/README.md`
- Modify only if generated by established guardrails: member/status artifact files.

**Interfaces:**

- Consumes all previous tasks.
- Produces verification evidence and a safe operator sequence; no auto-publish.

- [ ] **Step 1: Run the full read-only verification chain**

Run:

```bash
npm run verify:code
```

Expected: Prisma validation/generation, typecheck, lint, Prettier, guardrail tests, repository-context tests, backend tests, 32 CIQE tests, production build, security audit, and version check all PASS.

- [ ] **Step 2: Run a dry-run backfill and record the exact eligible set**

Run:

```bash
npm run catalog-images:backfill
```

Expected: no database/storage mutation; the three retained exact sources are evaluated, while any ineligible products are reported with explicit reasons.

- [ ] **Step 3: Identify Ligo product ID from the dry-run output and process only Ligo**

Run:

```bash
npm run catalog-images:backfill -- --product <LIGO_PRODUCT_ID> --apply
```

Expected: exactly one CIQE candidate is created/processed for Ligo and the current `Product.imageUrl` remains the legacy URL.

- [ ] **Step 4: Manual owner review before publication**

Run:

```bash
npm run dev:web
```

Open Products → Edit Ligo. Confirm the panel shows retained-original vs CIQE optimized preview and diagnostics. Only if the optimized result is acceptable, click `Use Optimized Image`.

After approval, confirm the storefront card uses `/api/storefront/product-images/<image-id>/card` and the PDP uses the corresponding `/pdp` variant. If CIQE returns `NEEDS_REVIEW` or `REJECTED`, leave the legacy image live and record the diagnostic instead of forcing publication.

- [ ] **Step 5: Apply the remaining eligible retained originals without auto-publishing**

Run:

```bash
npm run catalog-images:backfill -- --apply
```

Expected: already-processed Ligo is skipped by idempotence; remaining eligible sources become review candidates. Review/approve each separately in Products.

- [ ] **Step 6: Document verification evidence and run local prepush**

Update Sprint 6 evidence with exact commands/results and distinguish `approved-quality` from actually published images.

Run:

```bash
npm run prepush:local -- --member m1
```

Expected: `PASS: Local pre-push guardrails completed.`

- [ ] **Step 7: Review repository state before any push**

Run:

```bash
git status --short
git diff --check
```

Do not merge automatically. Commit/push only the reviewed Sprint 6 changes and generated status artifacts.
