# Catalog Image Quality Engine Design

Date: 2026-08-22
Sprint: 6
Branch: `sprint/v0.6/sprint-6`
Status: Approved architecture; implementation pending

## Problem

YsabelleStore currently accepts a product `imageUrl`, but the retailer should not be responsible for manually preparing every source image. Real product images may be blurry, over-cropped, too zoomed, too small inside a large canvas, inconsistently aligned, incorrectly oriented, or unsuitable for a larger PDP view. A frontend-only CSS treatment cannot recover or classify these source-quality problems reliably.

The system therefore needs a server-side image pipeline that can accept real uploaded product photos, make only safe deterministic corrections, generate fit-for-purpose variants, and prevent untrustworthy candidates from reaching the customer storefront.

## Chosen Architecture

Use a server-side `catalog-image-engine` with three layers:

1. **Deterministic processing core** — validates and decodes images, records quality diagnostics, auto-orients, normalizes canvas/scale, applies bounded enhancement, and generates derivatives.
2. **Publishing/state layer** — keeps candidate images separate from the active approved image, exposes `APPROVED`, `NEEDS_REVIEW`, and `REJECTED` image-quality states, and atomically promotes an accepted processed result.
3. **Optional local vision adapter** — may later provide subject segmentation/background cleanup or improved framing. It is not required for the baseline and cannot override truthfulness/safety rules.

The baseline should remain usable without a paid external image API.

## Why Hybrid Instead of One AI Model

Deterministic image operations are easier to test and constrain for orientation, resize, padding, compression, mild sharpening, and derivative generation. Local vision inference is useful for subject isolation but creates additional compute, portability, and false-positive risk. Separating the two keeps the critical catalog behavior predictable and lets local ML improve only the parts where benchmark evidence justifies it.

Generative reconstruction is explicitly excluded because a catalog image must not invent brand text, flavor, size, ingredients, barcode, claims, or missing packaging geometry.

## Processing Contract

### Input

A product-image candidate contains:

- uploaded binary image;
- product identifier when editing an existing product, or an upload session/reference while creating a new product;
- optional product metadata useful for diagnostics only (brand, variant, size);
- actor identity/role from the authenticated request.

The image engine must not trust client filename, MIME declaration, dimensions, or extension by themselves.

### Output

Processing returns a candidate record containing:

- stable candidate/image id;
- original source metadata;
- quality status;
- machine-readable diagnostics/reason codes;
- preview URL/path for the original;
- processed master preview URL/path when available;
- generated card/PDP variant references when publishable;
- processing version so future algorithm changes are auditable;
- timestamps and lifecycle state.

The product's active customer image is a separate approved pointer/reference. Processing a new candidate must never overwrite the active approved image in-place.

## Quality Analysis

The deterministic baseline should evaluate signals that can be measured without pretending to understand more than the pixels support:

- decodeable/supported file;
- pixel dimensions and aspect ratio;
- EXIF/orientation normalization needs;
- file/pixel budget;
- sharpness/blur proxy;
- brightness/contrast bounds;
- blank/near-uniform border or excess-canvas evidence;
- subject/product occupancy when deterministic foreground evidence is reliable;
- edge contact / framing evidence that can indicate likely clipping;
- expected derivative suitability, especially whether the source is large enough for PDP use without excessive upscale.

Diagnostics must use cautious language. For example, edge contact can mean `LIKELY_CROPPED_OR_TIGHT_FRAMING`; it must not claim that the full product is definitely missing unless a later validated model can support that conclusion.

## Status Policy

`APPROVED` means the processed candidate passes required technical and quality gates and can be shown to the owner for explicit acceptance/promotion.

`NEEDS_REVIEW` means the product record may still be saved, but the candidate should not be promoted automatically. Typical reasons include borderline blur, insufficient PDP resolution, uncertain tight framing, or questionable background/subject isolation.

`REJECTED` means the candidate cannot be safely used as a storefront image, such as invalid/corrupt content, unsupported format, extreme quality failure, or processing failure that leaves no valid derivative.

The initial thresholds must be calibrated against a representative YsabelleStore fixture corpus rather than chosen from arbitrary internet examples.

## Safe Normalization

For candidates that can be processed:

1. Decode and normalize orientation.
2. Preserve aspect ratio at all times.
3. Remove only confidently identified redundant outer canvas/background margins; never crop into the visible product to force a square.
4. Place the visible product/source onto a standard neutral catalog canvas with consistent safe padding.
5. Bound product fill ratio so an already tightly framed label does not become even larger.
6. Apply only conservative tonal correction, denoise, and sharpening with documented caps.
7. Downscale for derivatives using high-quality resampling.
8. Do not aggressively enlarge a small source. If a required variant would exceed the configured upscale allowance, generate the safest usable size and mark the relevant resolution diagnostic for review.
9. Encode optimized web-friendly variants while preserving a suitable processed master.

The system should prefer `contain` semantics end-to-end for product imagery unless a future product-media type explicitly allows deliberate cropping.

## Variant Strategy

Do not use one small file everywhere. The engine should generate named variants from the processed master, initially at least:

- **card** — optimized for product grids/search/storefront cards;
- **detail/PDP** — higher-resolution display for the product detail view;
- **preview** — suitable for the retailer Before/After approval UI.

Exact pixel targets, formats, and compression settings belong in implementation configuration and should be benchmarked against the current frontend layout. Variant metadata should include actual output dimensions so the frontend does not assume a file is larger than it is.

## Storage Architecture

Introduce an image-storage interface instead of scattering filesystem writes through controllers/services. The first implementation may use server/local filesystem storage suitable for local/LAN deployment. The interface should support later object storage without changing product/image business rules.

Storage responsibilities:

- allocate non-user-controlled object paths/ids;
- store original candidate and generated variants;
- expose safe application URLs/paths;
- atomically identify the approved set;
- retire rejected/superseded candidates according to lifecycle policy;
- never delete the currently active approved asset as part of replacement processing.

Repository source directories should not be used as runtime upload storage.

## Data Model Boundary

Image workflow state should not be overloaded into the existing general product `dataQualityStatus`. Sprint 6 should introduce image-specific persisted state so a valid product record is not treated as bad data merely because its photo needs replacement.

Conceptually the product needs an active approved image reference, while each uploaded candidate records processing/quality state and diagnostics. The final Prisma/schema shape must follow existing repository conventions discovered during implementation planning.

## API Boundary

The detailed route names are deferred to the implementation plan, but responsibilities should be separated:

- upload/process product-image candidate;
- read candidate processing result/diagnostics;
- accept/promote an approved processed candidate;
- discard/replace a candidate when appropriate;
- serve or resolve approved product-image variants.

Product create/update remains able to complete without a newly approved image. Candidate promotion must be authorization-checked and atomic with respect to the active image reference.

## Retailer UX

The Add/Edit Product experience should make the processing work understandable without exposing technical complexity:

1. Owner selects/drops an image.
2. UI shows `Processing image...` while the server analyzes it.
3. For a publishable result, UI shows **Original** and **Optimized** side by side or via an accessible comparison control.
4. Owner selects **Use optimized image** or **Upload another image**.
5. For `NEEDS_REVIEW`/`REJECTED`, UI explains the actionable reason, such as `Image is too low-resolution for product detail view` or `Product framing may be too tight`.
6. Product form can still save; the storefront continues using the previous approved image or a placeholder.

The UI must not imply that enhancement repaired missing information.

## Storefront Behavior

Product cards and PDP must resolve only approved image variants. During a replacement attempt:

- existing approved image remains visible;
- pending/rejected candidate is owner-only/admin-side data;
- if the product has never had an approved image, use the established placeholder/fallback;
- card and PDP choose their matching variants and preserve aspect ratio with consistent containment.

This directly prevents a bad upload from degrading an already-correct storefront.

## Local Vision Adapter

Define a narrow interface for optional subject detection/background cleanup. A concrete local model should be selected only after implementation-time feasibility/benchmark work on the target deployment environment.

Adapter contract should return masks/bounds/confidence or an explicit unavailable/failure state—not a newly imagined product image. The deterministic engine validates model output before using it. If confidence is too low or the model is absent, the system falls back to non-destructive deterministic normalization.

This keeps Sprint 6 independent of a specific model/runtime and avoids turning deployment into a mandatory GPU/large-model requirement.

## Security and Resource Controls

Image upload is untrusted binary input. Implementation must include:

- supported-format allowlist;
- MIME/content signature validation;
- pixel-count and file-size limits;
- safe decoder configuration and malformed-image handling;
- protection against decompression bombs/excessive memory allocation;
- generated storage ids instead of raw filenames;
- authorization for upload/accept/discard operations;
- bounded processing time/concurrency so image work cannot starve normal POS/inventory APIs;
- no remote URL fetch in the core upload endpoint unless a separate SSRF-safe design is approved later.

## Error Handling

Failures are categorized into user-correctable quality issues versus system-processing errors. User-correctable issues return stable reason codes and clear messages. Unexpected processing errors leave the current approved image unchanged and make the candidate non-publishable. Cleanup of partial temporary files must be idempotent.

## Testing Strategy

Use TDD for implementation. Build a small committed/licensed/synthetic fixture corpus representing shapes and failure modes rather than testing only one ideal product image.

Required coverage includes:

- corrupt/unsupported/spoofed uploads;
- orientation handling;
- aspect-ratio preservation;
- contain/padding rules;
- excess whitespace normalization;
- low-resolution no-aggressive-upscale behavior;
- blur/review classification;
- likely crop/tight-framing diagnostics;
- card/PDP variant dimensions;
- product save despite bad candidate;
- rejected replacement cannot displace existing approved image;
- atomic approval/promotion behavior;
- local vision adapter unavailable/failure fallback;
- frontend Before/After and reason-state behavior.

Performance tests should measure representative latency and peak memory at the configured upload limits.

## Rollout

Implement in stages:

**Stage 1:** upload/storage/security + deterministic diagnostics.

**Stage 2:** normalization and derivative generation.

**Stage 3:** persisted image candidate/approval workflow + storefront resolution.

**Stage 4:** retailer Before/After UI.

**Stage 5:** evaluate an optional local subject/background adapter against the representative corpus. Enable only if it improves useful framing without introducing unacceptable clipping/fabrication risk.

## Deferred Online Discovery

Online image search is not part of the core Sprint 6 pipeline. A later feature may search by barcode, brand, product, variant, and size, but candidate sources must have explicit reuse/source rules. Arbitrary public-web images are not presumed copyright-free and must not be auto-published.

## Acceptance Summary

Sprint 6 succeeds when product-image preparation becomes largely automatic for usable real-world photos, bad candidates cannot damage customer-facing imagery, the owner has a clear Before/After approval step, and no enhancement path fabricates product information.
