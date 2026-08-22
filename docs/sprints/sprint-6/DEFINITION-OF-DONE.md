# Sprint 6 Definition of Done

Sprint 6 is complete only when the product-image pipeline is implemented, regression-tested, and integrated into owner upload and customer display behavior.

## Upload and Safety

- [ ] Product image upload accepts only explicitly supported image formats.
- [ ] Declared MIME type is not trusted without content/magic-byte validation.
- [ ] Decode failures, malformed files, oversized dimensions, and decompression-bomb-like inputs fail safely.
- [ ] User filenames cannot control storage paths.
- [ ] Upload failure cannot partially replace a currently approved product image.

## Quality Analysis

- [ ] Engine records source dimensions and orientation.
- [ ] Clearly inadequate resolution can be classified without pretending an upscale restored lost detail.
- [ ] Blur/softness produces a diagnostic and can trigger `NEEDS_REVIEW` or `REJECTED` according to calibrated thresholds.
- [ ] Excessive blank canvas/product-too-small is identified.
- [ ] Product/subject edge contact or equivalent evidence can flag likely crop risk without claiming certainty beyond available evidence.
- [ ] Quality decisions are deterministic for the baseline pipeline and covered by fixtures.

## Normalization

- [ ] Orientation is normalized safely.
- [ ] Aspect ratio is preserved.
- [ ] Product media is contained rather than stretched.
- [ ] Consistent visual padding/canvas behavior is applied.
- [ ] Small inputs are not aggressively enlarged.
- [ ] Tonal/sharpening operations have bounded parameters and never generate label/package content.
- [ ] Card and PDP variants are generated from the approved processed master using documented target constraints.

## Product and Publishing Behavior

- [ ] Product may be created/updated even if a candidate image is `NEEDS_REVIEW` or `REJECTED`.
- [ ] Unapproved candidate images cannot become customer-storefront images.
- [ ] A previously approved image remains active while a replacement is pending/rejected.
- [ ] Products without an approved image use the established placeholder/fallback behavior.
- [ ] Accepting a processed preview atomically promotes the approved asset/variant set.

## Retailer UX

- [ ] Add/Edit Product supports image file selection/upload.
- [ ] Processing state is visible and non-blocking where practical.
- [ ] Before/After preview clearly distinguishes original and processed image.
- [ ] Owner can accept the processed image or upload another source.
- [ ] Failed/review-required images present a useful reason rather than a generic failure.
- [ ] Keyboard, responsive, focus, and reduced-motion expectations remain intact.

## Optional Local Vision

- [ ] Baseline engine does not require an external paid image API.
- [ ] Any local subject/background model is behind a stable adapter interface.
- [ ] Model absence/failure falls back safely to deterministic processing.
- [ ] Model output is never allowed to synthesize missing packaging facts.
- [ ] Background cleanup is enabled only when validation demonstrates it preserves the full product reliably enough for the supported corpus.

## Verification

- [ ] Unit tests cover analyzers, normalization limits, status decisions, and publishing invariants.
- [ ] Integration tests cover upload -> process -> preview -> accept and upload -> reject -> product-save flows.
- [ ] Regression test proves a rejected replacement cannot displace an existing approved image.
- [ ] Representative image fixtures cover cans, bottles, sachets, boxes, wide promotional sources, excess whitespace, blur, low resolution, and likely clipping.
- [ ] Frontend lint/typecheck/build pass for affected workspace.
- [ ] Backend lint/typecheck/tests pass for affected workspace.
- [ ] Full repository verification required by the active guardrails passes before Sprint 6 completion is claimed.
- [ ] Processing latency/memory limits are measured and documented for supported upload limits.

## Truthfulness Rule

No completion claim is valid if the system makes a visually convincing but factually fabricated product image. A source that cannot be safely repaired must remain review-required/rejected instead.
