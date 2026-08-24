# CIQE Legacy Image Backfill Design

Date: 2026-08-23
Branch: `sprint/v0.6/sprint-6`
Status: Proposed for implementation after user review

## Goal

Pass the existing catalog product images through the already-built Catalog Image Quality Engine (CIQE) without replacing a working storefront image until an owner explicitly approves the processed result.

This is an onboarding/backfill flow, not a second image-processing system. It must reuse the same CIQE upload inspection, deterministic Python/Pillow processing, diagnostics, quality states, storage layout, card/PDP variants, and approval rules already used by normal product-image uploads.

## Confirmed Repository State

- Existing legacy storefront images live under `frontend/public/images/products/`.
- Retained higher-quality source files live under `frontend/public/images/products/originals/`.
- The current provenance documentation states that only three exact catalog matches currently have `Product.imageUrl`: Gardenia, Ligo, and Sunsilk.
- Ligo has a retained `1275x1698` source under `originals/`, so the backfill must process that source rather than the smaller browser derivative.
- `ProductImageAsset` and `Product.activeImageAssetId` already provide the CIQE candidate/approval lifecycle.
- Approval already updates `activeImageAssetId` and switches `Product.imageUrl` to the public CIQE card route; PDP resolution is derived from that route.

## Safety Invariants

1. Never overwrite or remove the current `Product.imageUrl` during discovery or processing.
2. Never auto-approve a backfilled candidate.
3. Only explicit owner approval may publish a backfilled CIQE asset.
4. `NEEDS_REVIEW`, `REJECTED`, or failed processing must leave the current storefront image untouched.
5. Never fetch replacement product artwork from the internet during backfill.
6. Only process a retained local source whose filename maps exactly to the current legacy product image URL.
7. Never process arbitrary filesystem paths supplied by product data; path traversal must be rejected.
8. Never create a duplicate backfill candidate for a product that already has any CIQE image asset. Existing CIQE/manual work wins and the product is skipped.
9. No new generative image behavior, package reconstruction, or invented label detail.
10. No Prisma schema change is required for this first backfill pass.

## Eligibility

A product is eligible only when all conditions are true:

- `imageUrl` is a legacy local product URL under `/images/products/`;
- `activeImageAssetId` is null;
- the product has no existing `ProductImageAsset` rows;
- the matching basename exists under `frontend/public/images/products/originals/`;
- the retained file is a supported CIQE type and passes the existing upload policy.

Products that already have CIQE history, use a CIQE public route, have no legacy image, or have no retained original are reported as skipped and are not mutated.

## Architecture

### 1. Legacy source resolver

Add a small backend/catalog-image helper that converts an eligible legacy URL such as:

`/images/products/ligo-sardines-tomato-sauce-chili-added-155g.webp`

into the repository source path:

`frontend/public/images/products/originals/ligo-sardines-tomato-sauce-chili-added-155g.webp`

The resolver must accept only a single safe basename under the known legacy prefix. It must reject traversal, nested paths, absolute paths, remote URLs, query strings, and CIQE routes.

### 2. Backfill service

Add a backfill service that:

1. queries eligible products;
2. resolves the retained source path;
3. reads the file;
4. converts it into the same upload-file contract used by `createProductImageCandidate`;
5. calls the existing `createProductImageCandidate(productId, file)` function;
6. records the resulting candidate status in an in-memory/report result;
7. does not call `approveProductImageCandidate`.

CIQE's existing one-at-a-time process gate remains authoritative, so the backfill must not add independent heavy-image concurrency.

### 3. Safe CLI entry point

Add a root command such as:

`npm run catalog-images:backfill`

Default behavior is a dry run: list eligible, skipped, and missing-source products without writing database/storage state.

Mutation requires an explicit flag:

`npm run catalog-images:backfill -- --apply`

Support an optional single-product filter for controlled rollout/testing:

`npm run catalog-images:backfill -- --product <product-id>`

and combine it with `--apply` when ready.

The command must print a concise summary with counts for eligible, processed, approved-quality, needs-review, rejected, failed, and skipped products. `approved-quality` means the CIQE checker returned `APPROVED`; it does not mean published.

### 4. Owner review of backfilled candidates

Backfilled candidates must be visible through the existing product edit flow. Add a read-only backend endpoint to retrieve the latest CIQE candidate for a product, and add a corresponding frontend service call.

When `ProductImageUploadPanel` opens for an existing product and there is a non-superseded candidate, hydrate the panel from that candidate and load the same original/processed previews already supported by the UI.

The existing `Use Optimized Image` action remains the only publish action. No new approval semantics are introduced.

## Data Flow

`legacy Product.imageUrl`

→ exact retained source in `frontend/public/images/products/originals/`

→ existing upload inspection

→ existing `ProductImageAsset` candidate

→ existing CIQE engine

→ `processed.webp` + `card.webp` + `pdp.webp`

→ owner review in existing product image panel

→ explicit `Use Optimized Image`

→ existing approval transaction updates `activeImageAssetId` + storefront card URL

→ PDP automatically resolves the CIQE PDP variant

At every step before explicit approval, the old storefront image remains live.

## Error Handling

- Missing retained source: skip and report `SOURCE_NOT_FOUND`.
- Unsafe/unsupported source path or bytes: skip/report using existing upload-policy error information where practical.
- CIQE `NEEDS_REVIEW` or `REJECTED`: retain candidate for diagnostics/review; do not publish.
- CIQE processing failure: retain failed candidate and current storefront image; report failure.
- Existing image asset history: skip to avoid duplicate or conflicting work.
- One product failure must not abort the entire batch; continue with remaining products and return a non-zero exit only for command-level failures, not expected per-product quality outcomes.

## Testing

Implementation must be test-driven and include at least:

1. legacy source resolver accepts an exact `/images/products/<basename>` URL;
2. traversal, nested, remote, and CIQE URLs are rejected;
3. dry run performs no database or storage mutation;
4. eligible legacy product creates exactly one CIQE candidate on `--apply`;
5. rerunning backfill does not create a duplicate candidate;
6. existing `Product.imageUrl` and `activeImageAssetId` remain unchanged after processing;
7. `APPROVED` quality still requires explicit approval before publication;
8. `NEEDS_REVIEW`, `REJECTED`, and failed candidates cannot displace the current image;
9. latest-candidate owner endpoint returns the candidate for review;
10. product image panel can hydrate a backfilled candidate and reuse existing preview/approval actions;
11. approval still switches card URL and PDP resolves to the PDP variant;
12. existing CIQE, backend, storefront, lint, typecheck, build, and guardrail verification remain green.

## Rollout

1. Run dry-run and inspect the exact eligible set.
2. Run `--product <Ligo product id> --apply` first.
3. Review Ligo Original vs Optimized in Products and approve only if acceptable.
4. Confirm storefront card and PDP are now served from CIQE variants.
5. Apply the remaining eligible retained originals.
6. Review and approve them individually.
7. Leave missing/low-quality sources on the existing legacy image until a better exact source is supplied.

## Non-Goals

- No automatic internet image search or download.
- No automatic publication of `APPROVED` results.
- No bulk replacement of products without retained exact sources.
- No generative enhancement or reconstruction.
- No unrelated storefront redesign.
- No new branch and no merge as part of this work.
