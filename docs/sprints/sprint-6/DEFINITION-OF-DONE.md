# Sprint 6 Definition of Done

Sprint 6 is complete only when the product-image pipeline is implemented, regression-tested, and integrated into owner upload and customer display behavior.

## Upload and Safety

- [x] Product image upload accepts only explicitly supported image formats.
- [x] Declared MIME type is not trusted without content/magic-byte validation.
- [x] Decode failures, malformed files, oversized dimensions, and decompression-bomb-like inputs fail safely.
- [x] User filenames cannot control storage paths.
- [x] Upload failure cannot partially replace a currently approved product image.

## Quality Analysis

- [x] Engine records source dimensions and orientation.
- [x] Clearly inadequate resolution can be classified without pretending an upscale restored lost detail.
- [x] Blur/softness produces a diagnostic and can trigger `NEEDS_REVIEW` or `REJECTED` according to calibrated thresholds.
- [x] Excessive blank canvas/product-too-small is identified.
- [x] Product/subject edge contact or equivalent evidence can flag likely crop risk without claiming certainty beyond available evidence.
- [x] Quality decisions are deterministic for the baseline pipeline and covered by fixtures.

## Normalization

- [x] Orientation is normalized safely.
- [x] Aspect ratio is preserved.
- [x] Product media is contained rather than stretched.
- [x] Consistent visual padding/canvas behavior is applied.
- [x] Small inputs are not aggressively enlarged.
- [x] Tonal/sharpening operations have bounded parameters and never generate label/package content.
- [x] Card and PDP variants are generated from the approved processed master using documented target constraints.

## Product and Publishing Behavior

- [x] Product may be created/updated even if a candidate image is `NEEDS_REVIEW` or `REJECTED`.
- [x] Unapproved candidate images cannot become customer-storefront images.
- [x] A previously approved image remains active while a replacement is pending/rejected.
- [x] Products without an approved image use the established placeholder/fallback behavior.
- [x] Accepting a processed preview atomically promotes the approved asset/variant set.

## Retailer UX

- [x] Add/Edit Product supports image file selection/upload.
- [x] Processing state is visible and non-blocking where practical.
- [x] Before/After preview clearly distinguishes original and processed image.
- [x] Owner can accept the processed image or upload another source.
- [x] Failed/review-required images present a useful reason rather than a generic failure.
- [ ] Keyboard, responsive, focus, and reduced-motion expectations remain intact.

## Optional Local Vision

- [x] Baseline engine does not require an external paid image API.
- [x] Any local subject/background model is behind a stable adapter interface.
- [x] Model absence/failure falls back safely to deterministic processing.
- [x] Model output is never allowed to synthesize missing packaging facts.
- [x] Background cleanup is enabled only when validation demonstrates it preserves the full product reliably enough for the supported corpus.

## Verification

- [x] Unit tests cover analyzers, normalization limits, status decisions, and publishing invariants.
- [ ] Integration tests cover upload -> process -> preview -> accept and upload -> reject -> product-save flows.
- [x] Regression test proves a rejected replacement cannot displace an existing approved image.
- [x] Representative image fixtures cover cans, bottles, sachets, boxes, wide promotional sources, excess whitespace, blur, low resolution, and likely clipping.
- [ ] Frontend lint/typecheck/build pass for affected workspace.
- [ ] Backend lint/typecheck/tests pass for affected workspace.
- [ ] Full repository verification required by the active guardrails passes before Sprint 6 completion is claimed.
- [x] Processing latency/memory limits are measured and documented for supported upload limits.

## Phase 5 Evidence

Observed subsystem and performance evidence is recorded in [PHASE-5-VERIFICATION-EVIDENCE.md](PHASE-5-VERIFICATION-EVIDENCE.md). Items that require a full repository checkout remain unchecked until fresh command evidence exists.

## Truthfulness Rule

No completion claim is valid if the system makes a visually convincing but factually fabricated product image. A source that cannot be safely repaired must remain review-required/rejected instead.

## Validation Status

| Date       | Member     | Validation Checklist | Status | Notes                                                 |
| ---------- | ---------- | -------------------- | ------ | ----------------------------------------------------- |
| 2026-08-23 | M1 Abarado | npm run verify:code  | Passed | Aggregate read-only code verification passed locally. |
